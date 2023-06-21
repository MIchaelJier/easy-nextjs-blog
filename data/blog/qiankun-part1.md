---
title: 'Qiankun的隔离策略'
date: '2022/1/1'
lastmod: '2023/02/11'
tags: [Qiankun, 微前端]
draft: false
summary: '对于giankun来说，路由劫持是在single-spa上去做的，而giankun给我们提供的能力，主要便是子应用的加载和沙箱隔离。而资源隔离又分为Js资源隔离和css资源隔离。'
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

## 应用间运行时隔离

对于 qiankun 来说，路由劫持是在 single-spa 上去做的，而 qiankun 给我们提供的能力，主要便是子应用的加载和沙箱隔离。

### css 样式隔离

qiankun 为我们提供了两种方法：

- strictStyleIsolation：严格样式隔离，其实就是使用*shadowDom*将各个子应用包起来

  ```js
  /**
    * 做了两件事
    *  1、将 appContent 由字符串模版转换成 html dom 元素
    *  2、如果需要开启严格样式隔离，则将 appContent 的子元素即微应用的入口模版用 shadow dom 包裹起来，达到样式严格隔离的目的
    * @param appContent = `<div id="__qiankun_microapp_wrapper_for_${appInstanceId}__" data-name="${appName}">${template}</div>`
    * @param strictStyleIsolation 是否开启严格样式隔离
    */
    function createElement(appContent: string, strictStyleIsolation: boolean): HTMLElement {
      // 创建一个 div 元素
      const containerElement = document.createElement('div');
      // 将字符串模版 appContent 设置为 div 的子与阿苏
      containerElement.innerHTML = appContent;
      // appContent always wrapped with a singular div，appContent 由模版字符串变成了 DOM 元素
      const appElement = containerElement.firstChild as HTMLElement;
      // 如果开启了严格的样式隔离，则将 appContent 的子元素（微应用的入口模版）用 shadow dom 包裹，以达到微应用之间样式严格隔离的目的
      if (strictStyleIsolation) {
        if (!supportShadowDOM) {
          console.warn(
            '[qiankun]: As current browser not support shadow dom, your strictStyleIsolation configuration will be ignored!',
          );
        } else {
          const { innerHTML } = appElement;
          appElement.innerHTML = '';
          let shadow: ShadowRoot;

          if (appElement.attachShadow) {
            shadow = appElement.attachShadow({ mode: 'open' });
          } else {
            // createShadowRoot was proposed in initial spec, which has then been deprecated
            shadow = (appElement as any).createShadowRoot();
          }
          shadow.innerHTML = innerHTML;
        }
      }
      return appElement;
    }
  ```

  > 💡shadowDom 另外一篇文章有详细的介绍：[在 React 中使用 Shadow DOM](/blog/shadow-dom)

- experimentalStyleIsolation（实验性）：是给所有的样式选择器前面都加了当前挂载容器
  ![](/m-picture/qiankun-part1/experimentalStyleIsolation.png)

但是比如追加进 body 标签的 dialog modal 框之类的样式这两种方式就不合适了，我们还可以使用：

- BEM 规范
- CSS-Modules 打包时生成不冲突的选择器名
- postcss 加前缀
- css-in-js（tailwindcss 等)
  > ❗️ 这里不推荐使用 styled-components，由于 sc 的实现方式，会导致非第一次加载同一个子应用时（比如切换了子应用或者在主应用和子应用间切换），会随机性产生丢失 cssom 的样式 ———— [从标签模板到 styled-components/styled-components 和 qiankun](/blog/styled-components-all-in-one#styled-components和-qiankun)

### js 沙箱

![](/m-picture/qiankun-part1/sandbox.png)
乾坤中使用到了 3 种沙箱：legacySandBox、proxySandBox 是基于 Proxy API 来实现的，在不支持 Proxy API 的低版本浏览器中，会降级为 snapshotSandBox。在现版本中，legacySandBox 仅用于 singular 单实例模式，而多实例模式会使用 proxySandBox。

#### snapshotSandBox

```js
class SnapshotSandBox {
  windowSnapshot = {}
  modifyPropsMap = {}
  active() {
    for (const prop in window) {
      this.windowSnapshot[prop] = window[prop]
    }
    Object.keys(this.modifyPropsMap).forEach((prop) => {
      window[prop] = this.modifyPropsMap[prop]
    })
  }
  inactive() {
    for (const prop in window) {
      if (window[prop] !== this.windowSnapshot[prop]) {
        this.modifyPropsMap[prop] = window[prop]
        window[prop] = this.windowSnapshot[prop]
      }
    }
  }
}
let snapshotSandBox = new SnapshotSandBox()
snapshotSandBox.active()
window.city = 'Beijing'
console.log('window.city-01:', window.city) //window.city-01: Beijing
snapshotSandBox.inactive()
console.log('window.city-02:', window.city) //window.city-02: undefined
snapshotSandBox.active()
console.log('window.city-03:', window.city) //window.city-03: Beijing
snapshotSandBox.inactive()
```

从上面的代码可以看出，快照沙箱的核心逻辑很简单，就是在激活沙箱和沙箱失活的时候各做两件事情。

> 💡 注：沙箱激活 就是此时我们的微应用处于运行中，这个阶段有可能对 window 上的属性进行操作改变；沙箱失活 就是此时我们的微应用已经停止了对 window 的影响

在沙箱激活的时候：

- 记录 window 当时的状态（我们把这个状态称之为快照，也就是快照沙箱这个名称的来源）；
- 恢复上一次沙箱失活时记录的沙箱运行过程中对 window 做的状态改变，也就是上一次沙箱激活后对 window 做了哪些改变，现在也保持一样的改变。

在沙箱失活的时候：

- 记录 window 上有哪些状态发生了变化（沙箱自激活开始，到失活的这段时间）；
- 清除沙箱在激活之后在 window 上改变的状态，从代码可以看出，就是让 window 此时的属性状态和刚激活时候的 window 的属性状态进行对比，不同的属性状态就以快照为准，恢复到未改变之前的状态。

从上面可以看出，快照沙箱存在两个重要的问题：

- 会改变全局 window 的属性，如果同时运行多个微应用，多个应用同时改写 window 上的属性，势必会出现状态混乱，这也就是为什么快照沙箱无法支持多各微应用同时运行的原因。关于这个问题，下文中支持多应用的代理沙箱可以很好的解决这个问题；
- 会通过 for(prop in window){}的方式来遍历 window 上的所有属性，window 属性众多，这其实是一件很耗费性能的事情。关于这个问题支持单应用的代理沙箱和支持多应用的代理沙箱都可以规避。

---

- <details>
    <summary>
        snapshotSandBox源码
    </summary>
    关于SnapshotSandbox，由于逻辑相对简单，和极简版相比其实差别不大。值得提出来的是里面的iter方法，将遍历window属性的代码抽离出来了，调用这个工具方法后，我们只需要专注于迭代到相应属性时候需要进行的处理。
    ```js
    import type { SandBox } from '../interfaces';
    import { SandBoxType } from '../interfaces';
    function iter(obj: typeof window, callbackFn: (prop: any) => void) {
      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      for (const prop in obj) {
        // patch for clearInterval for compatible reason, see #1490
        if (obj.hasOwnProperty(prop) || prop === 'clearInterval') {
          callbackFn(prop);
        }
      }
    }
    /**
    * 基于 diff 方式实现的沙箱，用于不支持 Proxy 的低版本浏览器
    */
    export default class SnapshotSandbox implements SandBox {
      proxy: WindowProxy;
      name: string;
      type: SandBoxType;
      sandboxRunning = true;
      private windowSnapshot!: Window;
      private modifyPropsMap: Record<any, any> = {};
      constructor(name: string) {
        this.name = name;
        this.proxy = window;
        this.type = SandBoxType.Snapshot;
      }
      active() {
        // 记录当前快照
        this.windowSnapshot = {} as Window;
        iter(window, (prop) => {
          this.windowSnapshot[prop] = window[prop];
        });
        // 恢复之前的变更
        Object.keys(this.modifyPropsMap).forEach((p: any) => {
          window[p] = this.modifyPropsMap[p];
        });

        this.sandboxRunning = true;
      }
      inactive() {
        this.modifyPropsMap = {};
        iter(window, (prop) => {
          if (window[prop] !== this.windowSnapshot[prop]) {
            // 记录变更，恢复环境
            this.modifyPropsMap[prop] = window[prop];
            window[prop] = this.windowSnapshot[prop];
          }
        });
        if (process.env.NODE_ENV === 'development') {
          console.info(`[qiankun:sandbox] ${this.name} origin window restore...`, Object.keys(this.modifyPropsMap));
        }
        this.sandboxRunning = false;
      }

  }

  ```
  </details>
  ```

---

#### legacySandBox

```js
class LegacySandBox {
  addedPropsMapInSandbox = new Map()
  modifiedPropsOriginalValueMapInSandbox = new Map()
  currentUpdatedPropsValueMap = new Map()
  proxyWindow
  setWindowProp(prop, value, toDelete = false) {
    if (value === undefined && toDelete) {
      delete window[prop]
    } else {
      window[prop] = value
    }
  }
  active() {
    this.currentUpdatedPropsValueMap.forEach((value, prop) => this.setWindowProp(prop, value))
  }
  inactive() {
    this.modifiedPropsOriginalValueMapInSandbox.forEach((value, prop) =>
      this.setWindowProp(prop, value)
    )
    this.addedPropsMapInSandbox.forEach((_, prop) => this.setWindowProp(prop, undefined, true))
  }
  constructor() {
    const fakeWindow = Object.create(null)
    this.proxyWindow = new Proxy(fakeWindow, {
      set: (target, prop, value, receiver) => {
        const originalVal = window[prop]
        if (!window.hasOwnProperty(prop)) {
          this.addedPropsMapInSandbox.set(prop, value)
        } else if (!this.modifiedPropsOriginalValueMapInSandbox.has(prop)) {
          this.modifiedPropsOriginalValueMapInSandbox.set(prop, originalVal)
        }
        this.currentUpdatedPropsValueMap.set(prop, value)
        window[prop] = value
      },
      get: (target, prop, receiver) => {
        return target[prop]
      },
    })
  }
}
let legacySandBox = new LegacySandBox()
legacySandBox.active()
legacySandBox.proxyWindow.city = 'Beijing'
console.log('window.city-01:', window.city) // window.city-01: Beijing
legacySandBox.inactive()
console.log('window.city-02:', window.city) // window.city-02: undefined
legacySandBox.active()
console.log('window.city-03:', window.city) // window.city-03: Beijing
legacySandBox.inactive()
```

从上面的代码可以看出，其实现的功能和快照沙箱是一模一样的，不同的是，通过三个变量来记住沙箱激活后 window 发生变化过的所有属性，这样在后续的状态还原时候就不再需要遍历 window 的所有属性来进行对比，提升了程序运行的性能。但是这仍然改变不了这种机制仍然污染了 window 的状态的事实，因此也就无法承担起同时支持多个微应用运行的任务。

---

- <details>
    <summary>
        legacySandBox源码
    </summary>
    和极简版相比，会发现源码中LegacySandbox的proxy对象除了get、set，还有has、getWownPropertyDescriptor、defineProperty等方法，仔细看会发现，这里面的逻辑，不管是返回值还是设置值，都和get、set一样，都是针对的全局window。注意：如果对于赋值操作只管set，忽略方法Object.defineProperty也可以改变值，那将这个程序将会漏洞百出。同样如果不关心descriptor的状态，在实际编码过程中，可能就会忽略代码中注释指出的问题
    > A property cannot be reported as non-configurable, if it does not exists as an own property of the target object  
    > 译: 在getOwnPropertyDescriptor方法中，如果返回的descriptor不是target自己的属性的descriptor（所谓自己的属性的descriptor，就是能通过Object.getOwnPropertyDescriptor方法获取的descriptor），那这个descriptor的configurable值就不能是false
    ```js
    import type { SandBox } from '../../interfaces';
    import { SandBoxType } from '../../interfaces';
    import { getTargetValue } from '../common';
    
    function isPropConfigurable(target: WindowProxy, prop: PropertyKey) {
      const descriptor = Object.getOwnPropertyDescriptor(target, prop);
      return descriptor ? descriptor.configurable : true;
    }
    
    /**
      * 基于 Proxy 实现的沙箱
      * TODO: 为了兼容性 singular 模式下依旧使用该沙箱，等新沙箱稳定之后再切换
      */
    export default class LegacySandbox implements SandBox {
      /** 沙箱期间新增的全局变量 */
      private addedPropsMapInSandbox = new Map<PropertyKey, any>();
    
      /** 沙箱期间更新的全局变量 */
      private modifiedPropsOriginalValueMapInSandbox = new Map<PropertyKey, any>();
    
      /** 持续记录更新的(新增和修改的)全局变量的 map，用于在任意时刻做 snapshot */
      private currentUpdatedPropsValueMap = new Map<PropertyKey, any>();
    
      name: string;
    
      proxy: WindowProxy;
    
      globalContext: typeof window;
    
      type: SandBoxType;
    
      sandboxRunning = true;
    
      latestSetProp: PropertyKey | null = null;
    
      private setWindowProp(prop: PropertyKey, value: any, toDelete?: boolean) {
        if (value === undefined && toDelete) {
          // eslint-disable-next-line no-param-reassign
          delete (this.globalContext as any)[prop];
        } else if (isPropConfigurable(this.globalContext, prop) && typeof prop !== 'symbol') {
          Object.defineProperty(this.globalContext, prop, { writable: true, configurable: true });
          // eslint-disable-next-line no-param-reassign
          (this.globalContext as any)[prop] = value;
        }
      }
    
      active() {
        if (!this.sandboxRunning) {
          this.currentUpdatedPropsValueMap.forEach((v, p) => this.setWindowProp(p, v));
        }
    
        this.sandboxRunning = true;
      }
    
      inactive() {
        if (process.env.NODE_ENV === 'development') {
          console.info(`[qiankun:sandbox] ${this.name} modified global properties restore...`, [
            ...this.addedPropsMapInSandbox.keys(),
            ...this.modifiedPropsOriginalValueMapInSandbox.keys(),
          ]);
        }
    
        // renderSandboxSnapshot = snapshot(currentUpdatedPropsValueMapForSnapshot);
        // restore global props to initial snapshot
        this.modifiedPropsOriginalValueMapInSandbox.forEach((v, p) => this.setWindowProp(p, v));
        this.addedPropsMapInSandbox.forEach((_, p) => this.setWindowProp(p, undefined, true));
    
        this.sandboxRunning = false;
      }
    
      constructor(name: string, globalContext = window) {
        this.name = name;
        this.globalContext = globalContext;
        this.type = SandBoxType.LegacyProxy;
        const { addedPropsMapInSandbox, modifiedPropsOriginalValueMapInSandbox, currentUpdatedPropsValueMap } = this;
    
        const rawWindow = globalContext;
        const fakeWindow = Object.create(null) as Window;
    
        const setTrap = (p: PropertyKey, value: any, originalValue: any, sync2Window = true) => {
          if (this.sandboxRunning) {
            if (!rawWindow.hasOwnProperty(p)) {
              addedPropsMapInSandbox.set(p, value);
            } else if (!modifiedPropsOriginalValueMapInSandbox.has(p)) {
              // 如果当前 window 对象存在该属性，且 record map 中未记录过，则记录该属性初始值
              modifiedPropsOriginalValueMapInSandbox.set(p, originalValue);
            }
    
            currentUpdatedPropsValueMap.set(p, value);
    
            if (sync2Window) {
              // 必须重新设置 window 对象保证下次 get 时能拿到已更新的数据
              (rawWindow as any)[p] = value;
            }
    
            this.latestSetProp = p;
    
            return true;
          }
    
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[qiankun] Set window.${p.toString()} while sandbox destroyed or inactive in ${name}!`);
          }
    
          // 在 strict-mode 下，Proxy 的 handler.set 返回 false 会抛出 TypeError，在沙箱卸载的情况下应该忽略错误
          return true;
        };
    
        const proxy = new Proxy(fakeWindow, {
          set: (_: Window, p: PropertyKey, value: any): boolean => {
            const originalValue = (rawWindow as any)[p];
            
            return setTrap(p, value, originalValue, true);
          },
    
          get(_: Window, p: PropertyKey): any {
            // avoid who using window.window or window.self to escape the sandbox environment to touch the really window
            // or use window.top to check if an iframe context
            // see https://github.com/eligrey/FileSaver.js/blob/master/src/FileSaver.js#L13
            if (p === 'top' || p === 'parent' || p === 'window' || p === 'self') {
              return proxy;
            }
    
            const value = (rawWindow as any)[p];
            return getTargetValue(rawWindow, value);
          },
    
          // trap in operator
          // see https://github.com/styled-components/styled-components/blob/master/packages/styled-components/src/constants.js#L12
          has(_: Window, p: string | number | symbol): boolean {
            return p in rawWindow;
          },
    
          getOwnPropertyDescriptor(_: Window, p: PropertyKey): PropertyDescriptor | undefined {
            const descriptor = Object.getOwnPropertyDescriptor(rawWindow, p);
            // A property cannot be reported as non-configurable, if it does not exists as an own property of the target object
            if (descriptor && !descriptor.configurable) {
              descriptor.configurable = true;
            }
            return descriptor;
          },
    
          defineProperty(_: Window, p: string | symbol, attributes: PropertyDescriptor): boolean {
            const originalValue = (rawWindow as any)[p];
            const done = Reflect.defineProperty(rawWindow, p, attributes);
            const value = (rawWindow as any)[p];
            setTrap(p, value, originalValue, false);
    
            return done;
          },
        });
    
        this.proxy = proxy;
      }
    }
    ```
  </details>

---

#### ProxySandBox

```js
class ProxySandBox {
  proxyWindow
  isRunning = false
  active() {
    this.isRunning = true
  }
  inactive() {
    this.isRunning = false
  }
  constructor() {
    const fakeWindow = Object.create(null)
    this.proxyWindow = new Proxy(fakeWindow, {
      set: (target, prop, value, receiver) => {
        if (this.isRunning) {
          target[prop] = value
        }
      },
      get: (target, prop, receiver) => {
        return prop in target ? target[prop] : window[prop]
      },
    })
  }
}
let proxySandBox1 = new ProxySandBox()
let proxySandBox2 = new ProxySandBox()
proxySandBox1.active()
proxySandBox2.active()
proxySandBox1.proxyWindow.city = 'Beijing'
proxySandBox2.proxyWindow.city = 'Shanghai'
console.log('active:proxySandBox1:window.city:', proxySandBox1.proxyWindow.city) // active:proxySandBox1:window.city: Beijing
console.log('active:proxySandBox2:window.city:', proxySandBox2.proxyWindow.city) // active:proxySandBox2:window.city: Shanghai
console.log('window:window.city:', window.city) // window:window.city: undefined
proxySandBox1.inactive()
proxySandBox2.inactive()
console.log('inactive:proxySandBox1:window.city:', proxySandBox1.proxyWindow.city) // inactive:proxySandBox1:window.city: Beijing
console.log('inactive:proxySandBox2:window.city:', proxySandBox2.proxyWindow.city) // inactive:proxySandBox2:window.city: Shanghai
console.log('window:window.city:', window.city) // window:window.city: undefined
```

从上面的代码可以发现，ProxySandbox，完全不存在状态恢复的逻辑，同时也不需要记录属性值的变化，因为所有的变化都是沙箱内部的变化，和 window 没有关系，window 上的属性至始至终都没有受到过影响。我们可能会问，ProxySandbox 已经这么好了，性能优良还支持多个微应用同时运行，那自然也支持单个微应用运行，那 LegacySandbox 存在还有什么意义呢，这个问题问得很好，其实本身在未来存在的意义也不大了，只不过是因为历史原因还在服役罢了，从 Legacy 这个单词就已经能推断出 LegacySandbox 在乾坤中的位置。我们可能还会继续问，那 SnapshotSandbox 存在还有什么意义呢，这个还真有不小作用，Proxy 是新 ES6 的新事物，低版本浏览器无法兼容所以 SnapshotSandbox 还会长期存在。虽然这里极简版本逻辑很少，但是由于 ProxySandbox 要支持多个微应用运行，里面的逻辑会 SnapshotsSandbox、LegacySandbox 的都要丰富一些。

---

- <details>
      <summary>
          proxySandBox源码
      </summary>
      legacySandBox 最直接的不同点就是，为了支持多实例的场景，proxySandBox 不会直接操作 window 对象。并且为了避免子应用操作或者修改主应用上诸如 window、document、location 这些重要的属性，会遍历这些属性到子应用 window 副本（fakeWindow）上
      ```js
      import type { SandBox } from '../interfaces';
      import { SandBoxType } from '../interfaces';
      import { nativeGlobal, nextTask } from '../utils';
      import { getTargetValue, setCurrentRunningApp, getCurrentRunningApp } from './common';
      
      type SymbolTarget = 'target' | 'globalContext';
      
      type FakeWindow = Window & Record<PropertyKey, any>;
      
      /**
        * fastest(at most time) unique array method
        * @see https://jsperf.com/array-filter-unique/30
        */
      function uniq(array: Array<string | symbol>) {
        return array.filter(function filter(this: PropertyKey[], element) {
          return element in this ? false : ((this as any)[element] = true);
        }, Object.create(null));
      }
      
      // zone.js will overwrite Object.defineProperty
      const rawObjectDefineProperty = Object.defineProperty;
      
      const variableWhiteListInDev =
        process.env.NODE_ENV === 'development' || window.__QIANKUN_DEVELOPMENT__
          ? [
              // for react hot reload
              // see https://github.com/facebook/create-react-app/blob/66bf7dfc43350249e2f09d138a20840dae8a0a4a/packages/react-error-overlay/src/index.js#L180
              '__REACT_ERROR_OVERLAY_GLOBAL_HOOK__',
            ]
          : [];
      // who could escape the sandbox
      const variableWhiteList: PropertyKey[] = [
        // FIXME System.js used a indirect call with eval, which would make it scope escape to global
        // To make System.js works well, we write it back to global window temporary
        // see https://github.com/systemjs/systemjs/blob/457f5b7e8af6bd120a279540477552a07d5de086/src/evaluate.js#L106
        'System',
      
        // see https://github.com/systemjs/systemjs/blob/457f5b7e8af6bd120a279540477552a07d5de086/src/instantiate.js#L357
        '__cjsWrapper',
        ...variableWhiteListInDev,
      ];
      
      /*
        variables who are impossible to be overwrite need to be escaped from proxy sandbox for performance reasons
        */
      const unscopables = {
        undefined: true,
        Array: true,
        Object: true,
        String: true,
        Boolean: true,
        Math: true,
        Number: true,
        Symbol: true,
        parseFloat: true,
        Float32Array: true,
        isNaN: true,
        Infinity: true,
        Reflect: true,
        Float64Array: true,
        Function: true,
        Map: true,
        NaN: true,
        Promise: true,
        Proxy: true,
        Set: true,
        parseInt: true,
        requestAnimationFrame: true,
      };
      
      const useNativeWindowForBindingsProps = new Map<PropertyKey, boolean>([
        ['fetch', true],
        ['mockDomAPIInBlackList', process.env.NODE_ENV === 'test'],
      ]);
      
      function createFakeWindow(globalContext: Window) {
        // map always has the fastest performance in has check scenario
        // see https://jsperf.com/array-indexof-vs-set-has/23
        const propertiesWithGetter = new Map<PropertyKey, boolean>();
        const fakeWindow = {} as FakeWindow;
      
        /*
          copy the non-configurable property of global to fakeWindow
          see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getOwnPropertyDescriptor
          > A property cannot be reported as non-configurable, if it does not exists as an own property of the target object or if it exists as a configurable own property of the target object.
          */
        Object.getOwnPropertyNames(globalContext)
          .filter((p) => {
            const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
            return !descriptor?.configurable;
          })
          .forEach((p) => {
            const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
            if (descriptor) {
              const hasGetter = Object.prototype.hasOwnProperty.call(descriptor, 'get');
      
              /*
                make top/self/window property configurable and writable, otherwise it will cause TypeError while get trap return.
                see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/get
                > The value reported for a property must be the same as the value of the corresponding target object property if the target object property is a non-writable, non-configurable data property.
                */
              if (
                p === 'top' ||
                p === 'parent' ||
                p === 'self' ||
                p === 'window' ||
                (process.env.NODE_ENV === 'test' && (p === 'mockTop' || p === 'mockSafariTop'))
              ) {
                descriptor.configurable = true;
                /*
                  The descriptor of window.window/window.top/window.self in Safari/FF are accessor descriptors, we need to avoid adding a data descriptor while it was
                  Example:
                  Safari/FF: Object.getOwnPropertyDescriptor(window, 'top') -> {get: function, set: undefined, enumerable: true, configurable: false}
                  Chrome: Object.getOwnPropertyDescriptor(window, 'top') -> {value: Window, writable: false, enumerable: true, configurable: false}
                  */
                if (!hasGetter) {
                  descriptor.writable = true;
                }
              }
      
              if (hasGetter) propertiesWithGetter.set(p, true);
      
              // freeze the descriptor to avoid being modified by zone.js
              // see https://github.com/angular/zone.js/blob/a5fe09b0fac27ac5df1fa746042f96f05ccb6a00/lib/browser/define-property.ts#L71
              rawObjectDefineProperty(fakeWindow, p, Object.freeze(descriptor));
            }
          });
      
        return {
          fakeWindow,
          propertiesWithGetter,
        };
      }
      
      let activeSandboxCount = 0;
      
      /**
        * 基于 Proxy 实现的沙箱
        */
      export default class ProxySandbox implements SandBox {
        /** window 值变更记录 */
        private updatedValueSet = new Set<PropertyKey>();
      
        name: string;
      
        type: SandBoxType;
      
        proxy: WindowProxy;
      
        globalContext: typeof window;
      
        sandboxRunning = true;
      
        latestSetProp: PropertyKey | null = null;
      
        private registerRunningApp(name: string, proxy: Window) {
          if (this.sandboxRunning) {
            const currentRunningApp = getCurrentRunningApp();
            if (!currentRunningApp || currentRunningApp.name !== name) {
              setCurrentRunningApp({ name, window: proxy });
            }
            // FIXME if you have any other good ideas
            // remove the mark in next tick, thus we can identify whether it in micro app or not
            // this approach is just a workaround, it could not cover all complex cases, such as the micro app runs in the same task context with master in some case
            nextTask(() => {
              setCurrentRunningApp(null);
            });
          }
        }
      
        active() {
          if (!this.sandboxRunning) activeSandboxCount++;
          this.sandboxRunning = true;
        }
      
        inactive() {
          if (process.env.NODE_ENV === 'development') {
            console.info(`[qiankun:sandbox] ${this.name} modified global properties restore...`, [
              ...this.updatedValueSet.keys(),
            ]);
          }
      
          if (--activeSandboxCount === 0) {
            variableWhiteList.forEach((p) => {
              if (this.proxy.hasOwnProperty(p)) {
                // @ts-ignore
                delete this.globalContext[p];
              }
            });
          }
      
          this.sandboxRunning = false;
        }
      
        constructor(name: string, globalContext = window) {
          this.name = name;
          this.globalContext = globalContext;
          this.type = SandBoxType.Proxy;
          const { updatedValueSet } = this;
      
          const { fakeWindow, propertiesWithGetter } = createFakeWindow(globalContext);
      
          const descriptorTargetMap = new Map<PropertyKey, SymbolTarget>();
          const hasOwnProperty = (key: PropertyKey) => fakeWindow.hasOwnProperty(key) || globalContext.hasOwnProperty(key);
      
          const proxy = new Proxy(fakeWindow, {
            set: (target: FakeWindow, p: PropertyKey, value: any): boolean => {
              if (this.sandboxRunning) {
                this.registerRunningApp(name, proxy);
                // We must kept its description while the property existed in globalContext before
                if (!target.hasOwnProperty(p) && globalContext.hasOwnProperty(p)) {
                  const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
                  const { writable, configurable, enumerable } = descriptor!;
                  if (writable) {
                    Object.defineProperty(target, p, {
                      configurable,
                      enumerable,
                      writable,
                      value,
                    });
                  }
                } else {
                  // @ts-ignore
                  target[p] = value;
                }
      
                if (variableWhiteList.indexOf(p) !== -1) {
                  // @ts-ignore
                  globalContext[p] = value;
                }
      
                updatedValueSet.add(p);
      
                this.latestSetProp = p;
      
                return true;
              }
      
              if (process.env.NODE_ENV === 'development') {
                console.warn(`[qiankun] Set window.${p.toString()} while sandbox destroyed or inactive in ${name}!`);
              }
      
              // 在 strict-mode 下，Proxy 的 handler.set 返回 false 会抛出 TypeError，在沙箱卸载的情况下应该忽略错误
              return true;
            },
      
            get: (target: FakeWindow, p: PropertyKey): any => {
              this.registerRunningApp(name, proxy);
      
              if (p === Symbol.unscopables) return unscopables;
              // avoid who using window.window or window.self to escape the sandbox environment to touch the really window
              // see https://github.com/eligrey/FileSaver.js/blob/master/src/FileSaver.js#L13
              if (p === 'window' || p === 'self') {
                return proxy;
              }
      
              // hijack globalWindow accessing with globalThis keyword
              if (p === 'globalThis') {
                return proxy;
              }
      
              if (
                p === 'top' ||
                p === 'parent' ||
                (process.env.NODE_ENV === 'test' && (p === 'mockTop' || p === 'mockSafariTop'))
              ) {
                // if your master app in an iframe context, allow these props escape the sandbox
                if (globalContext === globalContext.parent) {
                  return proxy;
                }
                return (globalContext as any)[p];
              }
      
              // proxy.hasOwnProperty would invoke getter firstly, then its value represented as globalContext.hasOwnProperty
              if (p === 'hasOwnProperty') {
                return hasOwnProperty;
              }
      
              if (p === 'document') {
                return document;
              }
      
              if (p === 'eval') {
                return eval;
              }
      
              const value = propertiesWithGetter.has(p)
                ? (globalContext as any)[p]
                : p in target
                ? (target as any)[p]
                : (globalContext as any)[p];
              /* Some dom api must be bound to native window, otherwise it would cause exception like 'TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation'
                  See this code:
                    const proxy = new Proxy(window, {});
                    const proxyFetch = fetch.bind(proxy);
                    proxyFetch('https://qiankun.com');
              */
              const boundTarget = useNativeWindowForBindingsProps.get(p) ? nativeGlobal : globalContext;
              return getTargetValue(boundTarget, value);
            },
      
            // trap in operator
            // see https://github.com/styled-components/styled-components/blob/master/packages/styled-components/src/constants.js#L12
            has(target: FakeWindow, p: string | number | symbol): boolean {
              return p in unscopables || p in target || p in globalContext;
            },
      
            getOwnPropertyDescriptor(target: FakeWindow, p: string | number | symbol): PropertyDescriptor | undefined {
              /*
                as the descriptor of top/self/window/mockTop in raw window are configurable but not in proxy target, we need to get it from target to avoid TypeError
                see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getOwnPropertyDescriptor
                > A property cannot be reported as non-configurable, if it does not exists as an own property of the target object or if it exists as a configurable own property of the target object.
                */
              if (target.hasOwnProperty(p)) {
                const descriptor = Object.getOwnPropertyDescriptor(target, p);
                descriptorTargetMap.set(p, 'target');
                return descriptor;
              }
      
              if (globalContext.hasOwnProperty(p)) {
                const descriptor = Object.getOwnPropertyDescriptor(globalContext, p);
                descriptorTargetMap.set(p, 'globalContext');
                // A property cannot be reported as non-configurable, if it does not exists as an own property of the target object
                if (descriptor && !descriptor.configurable) {
                  descriptor.configurable = true;
                }
                return descriptor;
              }
      
              return undefined;
            },
      
            // trap to support iterator with sandbox
            ownKeys(target: FakeWindow): ArrayLike<string | symbol> {
              return uniq(Reflect.ownKeys(globalContext).concat(Reflect.ownKeys(target)));
            },
      
            defineProperty(target: Window, p: PropertyKey, attributes: PropertyDescriptor): boolean {
              const from = descriptorTargetMap.get(p);
              /*
                Descriptor must be defined to native window while it comes from native window via Object.getOwnPropertyDescriptor(window, p),
                otherwise it would cause a TypeError with illegal invocation.
                */
              switch (from) {
                case 'globalContext':
                  return Reflect.defineProperty(globalContext, p, attributes);
                default:
                  return Reflect.defineProperty(target, p, attributes);
              }
            },
      
            deleteProperty: (target: FakeWindow, p: string | number | symbol): boolean => {
              this.registerRunningApp(name, proxy);
              if (target.hasOwnProperty(p)) {
                // @ts-ignore
                delete target[p];
                updatedValueSet.delete(p);
      
                return true;
              }
      
              return true;
            },
      
            // makes sure `window instanceof Window` returns truthy in micro app
            getPrototypeOf() {
              return Reflect.getPrototypeOf(globalContext);
            },
          });
      
          this.proxy = proxy;
      
          activeSandboxCount++;
        }
      }
      ```
    </details>
  - 源码里面有一个uniq方法，我单独放在下面。filter的第1个参数是一个函数，第二个参数是一个对象。具体参数的含义可以查阅相关文档。这里之所以提出来，就是里面巧妙的运用了这个this。通过在this上设置属性，并以之为条件来实现去重功能。另外关于这个this，会发现function filter(this: PropertyKey[], element) 第一个参数是this，正常在javascript这是会运行出错的，其实出现在这里仅仅是typescript用作类型推断，编译后应该是没有这个参数的，所以我们可以认为这里的第一个参数就是element，我在第一次阅读到这里的时候因为对这个typescript的小语法点不清楚，疑惑了好一会查文档才搞清楚。
    ```js
    /**
     * fastest(at most time) unique array method
    * @see https://jsperf.com/array-filter-unique/30
    */
    function uniq(array: Array<string | symbol>) {
        return array.filter(function filter(this: PropertyKey[], element) {
          return element in this ? false : ((this as any)[element] = true);
        }, Object.create(null));
    }
    ```

## 参考

> [css 样式隔离和 js 沙箱](https://juejin.cn/post/6896643767353212935#heading-4)  
> [js 沙箱，Web Worker](https://mp.weixin.qq.com/s/VRERMga1noJJVZJdvl7n3Q)
