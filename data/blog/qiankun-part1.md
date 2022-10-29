---
title: 'Qiankun 微应用通信和隔离策略'
date: '2022/1/1'
lastmod: '2022/3/10'
tags: [Qiankun, 微前端]
draft: false
summary: '从 qiankun 看多种隔离方案和应用间通信方案，如何使用最优解。'
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

### 应用间运行时隔离

对于 qiankun 来说，路由劫持是在 single-spa 上去做的，而 qiankun 给我们提供的能力，主要便是子应用的加载和沙箱隔离。

> [参考 1：css 样式隔离和 js 沙箱](https://juejin.cn/post/6896643767353212935#heading-4)  
> [参考 2：js 沙箱，Web Worker](https://mp.weixin.qq.com/s/VRERMga1noJJVZJdvl7n3Q)

#### css 样式隔离

- strictStyleIsolation：严格样式隔离，其实就是使用*shadowDom*将各个子应用包起来
- experimentalStyleIsolation：是给所有的样式选择器前面都加了当前挂载容器
- 其他
  使用以上两种 qiankun 提供方法的问题：追加进 body 标签的 dialog modal 框 之类的样式 这个方式就不合适了 - BEM 规范 - CSS-Modules 打包时生成不冲突的选择器名 - postcss 加前缀 - css-in-js

#### js 沙箱

- <details>
    <summary>
        legacySandBox
    </summary>
    legacySandBox 还是会操作 window 对象，但是他通过激活沙箱时还原子应用的状态，卸载时还原主应用的状态来实现沙箱隔离的
  </details>
- <details>
    <summary>
        proxySandBox
    </summary>
    legacySandBox 最直接的不同点就是，为了支持多实例的场景，proxySandBox 不会直接操作 window 对象。并且为了避免子应用操作或者修改主应用上诸如 window、document、location 这些重要的属性，会遍历这些属性到子应用 window 副本（fakeWindow）上
  </details>
- snapshotSandBox：对当前的 window 和记录的快照做 diff 来实现沙箱
  借鉴 阿里云开发平台的 Browser VM：
  - 借鉴 with 的实现效果，_在 webpack 编译打包阶段为每个子应用代码包裹一层代码_（见其插件包 breezr-plugin-os 下相关文件），创建一个闭包，传入自己模拟的 window、document、location、history 等全局对象（见 根目录下 相关文件）。
  - 在模拟的 Context 中，_new 一个 iframe 对象_，提供一个和宿主应用空的（about:blank) 同域 URL 来作为这个 iframe 初始加载的 URL（空的 URL 不会发生资源加载，但是会产生和这个 iframe 中关联的 history 不能被操作的问题，这时路由的变换只支持 hash 模式），然后将其下的原生浏览器对象通过 contentWindow 取出来（因为 iframe 对象天然隔离，这里省去了自己 Mock 实现所有 API 的成本）。
  - 取出对应的 iframe 中原生的对象之后，继续对特定需要隔离的对象生成对应的 Proxy，然后对一些属性获取和属性设置，做一些特定的实现（比如 window.document 需要返回特定的沙箱 document 而不是当前浏览器的 document 等）。
  - 为了文档内容能够被加载在同一个 DOM 树上，对于 document，大部分的 DOM 操作的属性和方法仍旧直接使用宿主浏览器中的 document 的属性和方法处理等。

其中 legacySandBox、proxySandBox 是基于 Proxy API 来实现的，在不支持 Proxy API 的低版本浏览器中，会降级为 snapshotSandBox。在现版本中，legacySandBox 仅用于 singular 单实例模式，而多实例模式会使用 proxySandBox。

### 应用间通信

> [参考 1](https://juejin.cn/post/6844904151231496200#heading-9)

#### Actions 通信

##### 原理

_全局状态池和观察者函数进行应用间通信_
qiankun 内部提供了 initGlobalState 方法用于注册 MicroAppStateActions 实例用于通信，该实例有三个方法，分别是：

- setGlobalState：设置 globalState - 设置新的值时，内部将执行 浅检查，如果检查到 globalState 发生改变则触发通知，通知到所有的 观察者 函数。
- onGlobalStateChange：注册 观察者 函数 - 响应 globalState 变化，在 globalState 发生改变时触发该 观察者 函数。
- offGlobalStateChange：取消 观察者 函数 - 该实例不再响应 globalState 变化。
  ![](//www.michaeljier.cn/m-picture/qiankun-part1/16350881224248.jpg)

##### 优缺点：

- 优点：
  - 使用简单；
  - 官方支持性高；
  - 适合通信较少的业务场景；
- 缺点：
  - 子应用独立运行时，需要额外配置无 Actions 时的逻辑；
  - 子应用需要先了解状态池的细节，再进行通信；
  - 由于状态池无法跟踪，通信场景较多时，容易出现状态混乱、维护困难等问题；

#### Shared 通信

##### 原理

主应用基于 redux 维护一个状态池，通过 shared 实例暴露一些方法给子应用使用。同时，子应用需要单独维护一份 shared 实例，在独立运行时使用自身的 shared 实例，在嵌入主应用时使用主应用的 shared 实例，这样就可以保证在使用和表现上的一致性。

##### 优缺点

- 优点：
  - 可以自由选择状态管理库，更好的开发体验。 - 比如 redux 有专门配套的开发工具可以跟踪状态的变化。
  - 子应用无需了解主应用的状态池实现细节，只需要了解 shared 的函数抽象，实现一套自身的 shared 甚至空 shared 即可，可以更好的规范子应用开发。
  - 子应用无法随意污染主应用的状态池，只能通过主应用暴露的 shared 实例的特定方法操作状态池，从而避免状态池污染产生的问题。
  - 子应用将具备独立运行的能力，Shared 通信使得父子应用有了更好的解耦性。
- 缺点：
  - 主应用需要单独维护一套状态池，会增加维护成本和项目复杂度；
  - 子应用需要单独维护一份 shared 实例，会增加维护成本；
