---
title: 'Qiankun微前端中的应用通信'
date: '2022/1/08'
lastmod: '2022/3/10'
tags: [Qiankun, 微前端]
draft: false
summary: '对于微前端来说，应用间通信（主要为主应用-微应用）往往是架构设计之初就要考虑的核心需求。qiankun自身在通信方面并不提供完整的解决方案，更多的是提供api，通过这些api可以快捷地实现通讯功能，但是对于更丰富、未来可能更复杂地业务需求，我们还可以使用这些方案...'
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

## 应用间通信

> [参考：基于 qiankun 的微前端最佳实践（图文并茂） - 应用间通信篇](https://juejin.cn/post/6844904151231496200#heading-9)

对于微前端来说，应用间通信（主要为主应用-微应用）往往是架构设计之初就要考虑的核心需求。qiankun 自身在通信方面并不提供完整的解决方案，更多的是提供 api，通过这些 api 可以快捷地实现通讯功能，但是对于更丰富、未来可能更复杂地业务需求，我们还可以使用这些方案：
![](/m-picture/qiankun-part2/shared.png)

### Actions 通信

#### 原理

_全局状态池和观察者函数进行应用间通信_
qiankun 内部提供了 initGlobalState 方法用于注册 MicroAppStateActions 实例用于通信，该实例有三个方法，分别是：

- setGlobalState：设置 globalState - 设置新的值时，内部将执行 浅检查，如果检查到 globalState 发生改变则触发通知，通知到所有的 观察者 函数。
- onGlobalStateChange：注册 观察者 函数 - 响应 globalState 变化，在 globalState 发生改变时触发该 观察者 函数。
- offGlobalStateChange：取消 观察者 函数 - 该实例不再响应 globalState 变化。
  ![](/m-picture/qiankun-part2/actions.jpg)
  ![](/m-picture/qiankun-part2/initGlobalState.png)

#### 优缺点：

- 优点：
  - 使用简单；
  - 官方支持性高；
  - 适合通信较少的业务场景；
- 缺点：
  - 子应用独立运行时，需要额外配置无 Actions 时的逻辑；
  - 子应用需要先了解状态池的细节，再进行通信；
  - 由于状态池无法跟踪，通信场景较多时，容易出现状态混乱、维护困难等问题；

### Shared 通信

> [=> 具体代码](https://juejin.cn/post/6844904151231496200#heading-10)

#### 原理

主应用基于 redux 维护一个状态池，通过 shared 实例暴露一些方法给子应用使用。同时，子应用需要单独维护一份 shared 实例，在独立运行时使用自身的 shared 实例，在嵌入主应用时使用主应用的 shared 实例，这样就可以保证在使用和表现上的一致性。

#### 优缺点

- 优点：
  - 可以自由选择状态管理库，更好的开发体验。 - 比如 redux 有专门配套的开发工具可以跟踪状态的变化。
  - 子应用无需了解主应用的状态池实现细节，只需要了解 shared 的函数抽象，实现一套自身的 shared 甚至空 shared 即可，可以更好的规范子应用开发。
  - 子应用无法随意污染主应用的状态池，只能通过主应用暴露的 shared 实例的特定方法操作状态池，从而避免状态池污染产生的问题。
  - 子应用将具备独立运行的能力，Shared 通信使得父子应用有了更好的解耦性。
- 缺点：
  - 主应用需要单独维护一套状态池，会增加维护成本和项目复杂度；
  - 子应用需要单独维护一份 shared 实例，会增加维护成本；
