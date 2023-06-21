---
title: '重学 React 状态管理 - Context 篇'
date: '2023/06/21'
lastmod: '2023/06/21'
tags: [react, redux, context, request memoization]
draft: false
summary: 'React 提供了一种用于“数据管理”的机制 —— React.Context。本文将从概念、使用方式、存在的问题以及底层原理等方面，系统地分析 Context 在多层级组件之间实现数据传递的机制'
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

## 铺垫一下

在 React 应用开发中，状态管理始终是一项关键且复杂的任务。随着组件数量的增多和交互逻辑的加深，状态的传递、共享与维护往往变得难以控制。为了更好地理解 React 的状态管理机制，我们首先需要构建起它背后的心智模型，并明确一个优秀的状态管理方案究竟要解决哪些核心问题。

### 心智模型

状态更新有两种心智模型：

- 不可变状态模型
- 可变状态模型

### 状态管理库要解决的问题

- 从组件树的「任何地方」读取存储的状态
- 写入存储状态的能力
- 提供「优化渲染」的机制
- 提供「优化内存使用」的机制
- 与「并发模式的兼容性」
- 数据的「持久化」
- 「上下文丢失」问题
- 「props 失效」问题
- 「孤儿」问题

## Context 使用

这里不着重介绍 Context API 如何使用，可以直接看官方文档

> [使用 Context 深层传递参数](https://zh-hans.react.dev/learn/passing-data-deeply-with-context)  
> [使用 Reducer 和 Context 拓展你的应用](https://zh-hans.react.dev/learn/scaling-up-with-reducer-and-context)

我们直接通过一个简单示例来熟悉一下 Context 的使用方式：

```jsx
const Context = React.createContext(null)

const Child = () => {
  const value = React.useContext(Context)
  return <div>theme: {value.theme}</div>
}

const App = () => {
  const [count, setCount] = React.useState(0)
  return (
    <Context.Provider value={{ theme: 'light' }}>
      <div onClick={() => setCount(count + 1)}>触发更新</div>
      <Child />
    </Context.Provider>
  )
}

ReactDOM.render(<App />, document.getElementById('root'))
```

## Context 存在问题

当 `React Context` 中任意属性发生变化时，会引起所有使用到该 Context 的组件发生 force update，即重新渲染。但是我们希望当只有组件关心的值（或者说实际使用到的值）发生变化才会导致组件发生 re-render

- <details>
     <summary>demo 代码</summary>
      ```js
      import { createContext, useContext, useState } from "react";

      const context = createContext(null);

      const Count1 = () => {
        const { count1, setCount1 } = useContext(context);
        console.log("Count1 render");
        return <div onClick={() => setCount1(count1 + 1)}>count1: {count1}</div>;
      };

      const Count2 = () => {
        const { count2 } = useContext(context);
        console.log("Count2 render");
        return <div>count2: {count2}</div>;
      };

      const StateProvider = ({ children }) => {
        const [count1, setCount1] = useState(0);
        const [count2, setCount2] = useState(0);
        return (
          <context.Provider
            value={{
              count1,
              count2,
              setCount1,
              setCount2
            }}
          >
            {children}
          </context.Provider>
        );
      };

      const App = () => (
        <StateProvider>
          <Count1 />
          <Count2 />
        </StateProvider>
      );

      export default App;
      ```

  </details>

![](/m-picture/relearn-react-managing-state-part1/context-problem.gif)

可以看到在 context 中包含了 `count1` 和 `count2` 以及改变它们状态的方法，在 `<Count1 />` 与 `<Count2 />` 组件中分别引用了 `count1` 和 `count2`，当修改 `count1` 状态时可以发现 `<Count2 />` 组件也会发生 re-render，也就是重新渲染。很显然这里有性能上的问题，我们希望当 `count1` 状态发生变化时，不依赖该状态的组件不发生 re-render。

## 如何解决

### React 官方并未提供解决方案

在未合并的 PR 中，我们看到这么一个方案：我们会通过传入的第二个参数来选取我们需要的值，只有当这个值发生改变时才重新渲染，可以看到其实这就是我们想要达到理想的状态。但最终没有纳入官方 React，至少截至 React 18.3，还未合并进主包

> [RFC: Context selectors ](https://github.com/reactjs/rfcs/pull/119)

```js
const context = useContextSelector(Context, (c) => c.selectedField)
```

### 代码层面优化

1.  拆分 context，但是会带来新的问题：Provider hell
    ```jsx
    <context1.Provider value={}>
      <context2.Provider value={}>
        <context3.Provider value={}>
          {children}
        </context3.Provider>
      </context2.Provider>
    </context1.Provider>
    ```
2.  借助 memo 或 useMemo
    - 利用 `memo`，pureComponent 对子组件 props 进行浅比较处理
      ```jsx
      const Son = React.memo(() => <ConsumerDemo />)
      ```
    - 利用 `React` 本身对 `React element` 对象的缓存。React 每次执行 render 都会调用 createElement 形成新的 React element 对象，如果把 React element 缓存下来，下一次调和更新时候，就会跳过该 React element 对应 fiber 的更新
      ```jsx
      <ThemeProvider value={contextValue}>
        {React.useMemo(
          () => (
            <Son />
          ),
          []
        )}
      </ThemeProvider>
      ```

### use-context-selector（社区解决方案）

关于这个问题的解决方案分为了两派：

1. 不直接基于 `Context` 完成状态共享方案，比如我们耳熟能详的 Jotai、React Redux、Zustand 等等，这些库都不是直接基于 React Context 之上进行的改造，或者说是 React Context 的替代方案，本质上没有直接的关联，因此在状态共享的时候自然也就没有了 React Context 的性能问题。
2. 以 `use-context-selector` 为首的直接基于 `Context` 之上进行优化

我们着重来讲一下 `use-context-selector` 这个库。

`use-context-selector` 的用法非常简单，核心 API：`createContext/useContextSelector` 可以用来创建 context 和从 context 选取你需要的属性，如果这个属性没有发生变化则不会导致组件发生 re-render。

#### 简单实现

我们可以来简单实现一下：

- <details>
      <summary>createContext简单实现</summary>
      ```jsx
      import { createContext as createContextOrig, useLayoutEffect, useRef } from "react";

      const createProvider = (ProviderOrig) => {
        const ContextProvider = ({ value, children }) => {
          const contextValue = useRef();
          if (!contextValue.current) {
            const listeners = new Set();
            contextValue.current = {
              value,
              listeners,
            };
          }
          useLayoutEffect(() => {
            contextValue.current.value = value;
            contextValue.current.listeners.forEach((listener) => {
              listener({ v: value });
            });
          }, [value]);
          return <ProviderOrig value={contextValue.current}>{children}</ProviderOrig>;
        };

        return ContextProvider;
      };

      function createContext(defaultValue) {
        const context = createContextOrig({
          value: defaultValue,
          listeners: new Set(),
        });
        context.Provider = createProvider(context.Provider);
        delete context.Consumer;
        return context;
      }
      ```
      我们需要保证传给 `Context Provider` 的 `value` 对象地址不变，这样在 React 内部做新旧 `value` 比较的时候（通过 `Object.is`）才能得出 `value` 无变化的结果（避免消费者组件的意外更新）。

      因此，代码里重写了 `context` 对象上默认的 `Provider` 组件，在我们的自定义 `Provider` 组件中，通过 `useRef` 创建了 `contextValue`，并在首次渲染时给 `contextValue` 赋一个初始对象，后续就不再更改 `contextValue` 的引用了。在 `contextValue` 对象中，包含了最新的 `value` 和 `listeners`。

      在自定义 `Provider` 接收到新的 `value` 时，更新 `contextValue` 内部的 `value` 属性，同时调用所有 `listeners`，并将最新的 `value` 传给每一个 `listener`。

     </details>

- <details>
      <summary>useContextSelector简单实现</summary>
      ```jsx
      import { useContext as useContextOrig, useLayoutEffect, useReducer } from "react";

      function useContextSelector(context, selector) {
        const contextValue = useContextOrig(context);
        const { value, listeners } = contextValue;

        const selected = selector(value);

        const [state, dispatch] = useReducer(
          (prev, action) => {
            const { v } = action;
            if (Object.is(prev[0], v)) {
              return prev;
            }
            const nextSelected = selector(v);
            if (Object.is(prev[1], nextSelected)) {
              return prev;
            }
            return [v, nextSelected];
          },
          [value, selected]
        );

        useLayoutEffect(() => {
          listeners.add(dispatch);
          return () => {
            listeners.delete(dispatch);
          };
        }, [listeners]);

        return selected;
      }
      ```

      通过 `React` 原生的 `useContext`，拿到了 `contextValue` 对象上的 `value` 和 `listeners`。
      在每一次渲染中，根据最新的 `selector` 和 `value` 计算出选择值 `selected`。

      运行 `useReducer` 得到 `dispatch` 函数，并将它添加到 `listeners` 中。

      如果 `value` 发生变化，就会执行 `listeners` 收集到的所有 `dispatch` 函数，并将最新的 `value` 作为参数传给 `dispatch` 函数，`dispatch` 触发 `reducer` 的内部逻辑，对比 `value` 和 选择值 `selected` 有无变化。在没有变化的情况下，返回上一次的 `state`，`state` 相同，React 就不会触发当前组件的重新渲染。
      </details>

但是上面实现的`useContextSelector` 不是完美的，它也有一些问题：

1. 当 `selector` 返回一个包含多个字段的对象时，`useContextSelector` 的表现和 React 原生的 `useContext` 表现几乎一样，即 `contextValue.current.value` 发生变化，始终导致该消费者组件重新渲染。
2. 假如一个组件通过 `useContextSelector` 选择了 A、B 两个字段，但根据组件里的某个内部状态，实际上只用到了 A 字段，在这种情况下，B 字段的值其实不会影响组件的渲染结果，所以合理情况下，B 字段的变化不应该导致组件的重新渲染。然而在实际情况中，B 字段发生变化，仍然会导致组件重新渲染。
3. 当在 Counter1 和 Counter2 组件之间来回点击 add count1 和 add count2 按钮，即使每次点击只更改 count1 或 count2，但 Counter1 和 Counter2 组件都会重新渲染。
   > 在 React 中，一个组件其实会对应两个 fiber，一个保存当前视图对应的相关信息，称为 current fiber；一个保存接下来要变化的视图对应的相关信息，称为 wip fiber。
   >
   > 当组件触发更新后，会在组件对应的两个 fiber 上都标记需要更新。当组件 render 完成后，会把 wip fiber 上的更新标记清除。当视图完成渲染后，current fiber 与 wip fiber 会交换位置（也就是说本次更新的 wip fiber 会变为下次更新的 current fiber）。
   >
   > 当我们第一次点击 add count1 的时候，Counter1 组件对应 current fiber 和 wip fiber 同时标记更新。组件渲染完成后，wip fiber 的更新标记被清除，但此时 current fiber 还存在更新标记。完成渲染后，current fiber 和 wip fiber 会互换位置。此时变成了：wip fiber 存在更新，current fiber 不存在更新。
   >
   > 当点击 add count2 的时候，由于 Counter1 组件的 wip fiber 存在更新，所以即使本次没有修改 count1，但 Counter1 组件仍然会重新渲染，就出现了 Counter1 和 Counter2 组件同时重新渲染的情况
4. 在 React 18 中，`useContextSelector` 的表现和 React 原生的 `useContext` 表现几乎一样，即 `contextValue.current.value` 发生变化，始终导致所有消费者组件重新渲染。

#### 改进版

在了解了上述问题后，我们来实现一版优化版的 useContextSelector。

1. 对于问题一，我们可以给 useContextSelector 增加第三个参数 equalityFn，该参数默认是 shallowEqual，也就是说，默认情况下，会对新旧 selected 值做浅比较，避免了 useContextSelector 返回对象时的性能问题。

   ```jsx
   function useContextSelector(context, selector, equalityFn = shallowEqual) {}
   ```

2. 对于问题二，暂时无解，需要使用类似 Vue 的 `Object.defineProperty` 或 `Proxy` 等劫持/代理方案，才能知道 selected 值有无被使用。
3. 对于问题三，这种现象只会在使用了 `useState` 或 `useReducer` 的情况下才会出现，那么我们的思路就是不依赖这两个 hook 了。参考 react-redux 中 useSelector 的实现，我们可以使用 React 18 的新 hook：`useSyncExternalStore`。在 React 17 中，可以使用 `use-sync-external-store` 这个 npm 包，它是 `useSyncExternalStore` 的向后兼容垫片。
4. 对于问题四，在改为使用 `useSyncExternalStore` 后，我们也不再依赖 `useReducer`，自然就没有这个问题了。

- <details>
     <summary>优化版实现</summary>
      ```jsx
      import {
        createContext as createContextOrig,
        useContext as useContextOrig,
        useLayoutEffect,
        useRef,
        useCallback,
        useSyncExternalStore,
      } from "react";
      import shallowEqual from "shallowequal";

      const createProvider = (ProviderOrig) => {
        const ContextProvider = ({ value, children }) => {
          const contextValue = useRef();
          if (!contextValue.current) {
            const listeners = new Set();
            contextValue.current = {
              value,
              listeners,
            };
          }
          useLayoutEffect(() => {
            contextValue.current.value = value;
            contextValue.current.listeners.forEach((listener) => {
              // 这里不同了，不再需要给 listener 传入参数
              listener();
            });
          }, [value]);
          return <ProviderOrig value={contextValue.current}>{children}</ProviderOrig>;
        };

        return ContextProvider;
      };

      function createContext(defaultValue) {
        const context = createContextOrig({
          value: defaultValue,
          listeners: new Set(),
        });
        context.Provider = createProvider(context.Provider);
        delete context.Consumer;
        return context;
      }

      // 基于 useSyncExternalStore 实现 useContextSelector
      function useContextSelector(context, selector, equalityFn = shallowEqual) {
        const contextValue = useContextOrig(context);
        const { value, listeners } = contextValue;

        const subscribe = useCallback(
          (callback) => {
            listeners.add(callback);
            return () => listeners.delete(callback);
          },
          [listeners]
        );

        const lastSnapshot = useRef(selector(value));

        const getSnapshot = () => {
          const nextSnapshot = selector(contextValue.value);

          if (equalityFn(lastSnapshot.current, nextSnapshot)) {
            return lastSnapshot.current;
          }

          lastSnapshot.current = nextSnapshot;
          return nextSnapshot;
        };

        return useSyncExternalStore(subscribe, getSnapshot);
      }
      ```
      上面的代码看起来很多，其实与未优化之前的版本相比，主要是 `useContextSelector` 的实现不同了：
      - 在 `contextValue.current.value` 发生变化后，`listeners` 会被遍历执行，其实就是执行上文提到的 `handleStoreChange`，它会使用我们传入的 `getSnapshot` 算出最新的 `snapshot`，如果 `snapshot` 发生了变化，就会渲染当前组件。
      - 在我们传入的 `getSnapshot` 函数中，将最新的 `snapshot` 值和上一次的 `snapshot` 值做浅比较，如果比较发现没变化，会返回上一个 `snapshot`，这在 `selector` 返回的 `selected` 值为对象时很有用，可以避免不必要的组件更新。

  </details>

## Context API 本质结构

我们以 React.createContext(defaultValue) 为起点来分析。

```js
const MyContext = React.createContext(defaultValue)
```

这个调用返回一个对象，结构大致如下（简化后的内部结构）：

```js
{
  $$typeof: REACT_CONTEXT_TYPE,
  _currentValue: defaultValue,
  Provider,
  Consumer,
  _calculateChangedBits, // 可选
  ...
}
```

Provider 是核心组件

```jsx
<MyContext.Provider value={...}>
```

它就是一个普通的组件，在渲染时会把 value 注入到当前的 Fiber tree 上。

## Fiber 中的 Context 数据流

每一个 Fiber 节点上会存储当前它可见的 context 值。

```js
Fiber.memoizedProps.value // Context Provider 提供的值
Fiber.dependencies // 当前节点依赖的 Context 列表
```

每次 render 时发生什么：

- 当你调用 useContext(SomeContext) 时

  - React 会把当前组件标记为“依赖了 SomeContext”
  - 并记录下来：fiber.dependencies.contexts = [SomeContext]

- 当 Provider.value 变化时：
  - React 会从 Provider 节点向下遍历 Fiber Tree，找到所有依赖了该 Context 的子组件。
  - 并把它们标记为需要更新（re-render）。

## 源码实现

React Context 的核心功能实现，主要依赖以下三个关键组成部分： 1. 创建 Context 实例：`React.createContext()` 2. 提供数据的 Provider：`<Context.Provider value={value}>` 3. 消费数据的 useContext：`const value = useContext(Context)`

深入理解 Context 的行为离不开其源码实现。以下将结合源码，从创建、使用到更新流程逐一展开分析。

### createContext 的实现

源码位于 `react/src/ReactContext.js`，其本质是返回一个包含 Provider 和 Consumer 的 context 对象。该对象还持有当前值 `_currentValue`，用于在消费组件中读取

```js
const REACT_PROVIDER_TYPE = Symbol.for('react.provider')
const REACT_CONTEXT_TYPE = Symbol.for('react.context')

export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    _calculateChangedBits: calculateChangedBits,
    // 并发渲染器方案，分为主渲染器和辅助渲染器
    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    _threadCount: 0, // 跟踪此上下文当前有多少个并发渲染器
    Provider: (null: any),
    Consumer: (null: any),
  }

  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  }

  context.Consumer = context

  return context
}
```

关键点：

- Provider 与 Consumer 实际是 context 对象中的两个引用；
- `_currentValue` 是当前 context 的实际数据来源。

### useContext 消费数据流程

当函数组件使用 `useContext(Context) `时，实际上做了两件事： 1. 从 `context._currentValue `中读取当前值； 2. 将该 context 的依赖记录到当前正在构建的 Fiber 的 dependencies 中，用于变更追踪。

```js
function useContext(Context) {
  // 将 context 记录在当前 Fiber.dependencies 节点上，在 Provider 检测到 value 更新后，会查找消费组件标记更新。
  const contextItem = {
    context: context,
    next: null, // 一个组件可能注册多个不同的 context
  }
  if (lastContextDependency === null) {
    lastContextDependency = contextItem
    currentlyRenderingFiber.dependencies = {
      lanes: NoLanes,
      firstContext: contextItem,
      responders: null,
    }
  } else {
    // Append a new context item.
    lastContextDependency = lastContextDependency.next = contextItem
  }
  return context._currentValue
}
```

> 这一步是后续 Provider 更新时，能够找到依赖于该 Context 的组件并触发更新的关键。

### Provider 的工作机制（Fiber 层）

经过上面 useContext 消费组件的分析，我们需要思考两点：

1. `<Provider>` 组件上的 value 值何时更新到 `context._currentValue` ？
2. `Provider.value` 值发生更新后，如果能够让消费组件进行重渲染 ？

当 Provider 的 value 发生变更，React 会在调和阶段（Reconciler）处理对应 Fiber：

> Provider Fiber 类型为 ContextProvider，因此进入 tag switch case 中的 updateContextProvider

```js
function beginWork(current, workInProgress, renderLanes) {
  ...
  switch (workInProgress.tag) {
    case ContextProvider:
      return updateContextProvider(current, workInProgress, renderLanes);
  }
}
```

首先，更新 context.\_currentValue，比较新老 value 是否发生变化。  
注意，这里使用的是 Object.is，通常我们传递的 value 都是一个复杂对象类型，它将比较两个对象的引用地址是否相同。  
若引用地址未发生变化，则会进入 bailout 复用当前 Fiber 节点(跳过整个子树)。

> 在 bailout 中，会检查该 Fiber 的所有子孙 Fiber 是否存在 lane 更新。若所有子孙 Fiber 本次都没有更新需要执行，则 bailout 会直接返回 null，整棵子树都被跳过更新。

```js
function updateContextProvider(current, workInProgress, renderLanes) {
  var providerType = workInProgress.type
  var context = providerType._context
  var newProps = workInProgress.pendingProps
  var oldProps = workInProgress.memoizedProps
  var newValue = newProps.value
  var oldValue = oldProps.value

  // 1、更新 value prop 到 context 中
  context._currentValue = nextValue

  // 2、比较前后 value 是否有变化，这里使用 Object.is 进行比较（对于对象，仅比较引用地址是否相同）
  if (objectIs(oldValue, newValue)) {
    // children 也相同，进入 bailout，结束子树的协调
    if (oldProps.children === newProps.children && !hasContextChanged()) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)
    }
  } else {
    // 3、context value 发生变化，深度优先遍历查找 consumer 消费组件，标记更新
    propagateContextChange(workInProgress, context, changedBits, renderLanes)
  }

  // ... reconciler children
}
```

### propagateContextChange：传播变更并标记更新

若 `context.value` 发生变化，调用 `propagateContextChange` 对 Fiber 子树向下深度优先遍历，目的是为了查找 Context 消费组件，并为其标记 lane 更新，即让其后续进入 `Reconciler/beginWork` 阶段后不满足 bailout 条件 `!includesSomeLane(renderLanes, updateLanes)`。

```js
function propagateContextChange(workInProgress, context, changedBits, renderLanes) {
  var fiber = workInProgress.child;

  while (fiber !== null) {
    var nextFiber;
    var list = fiber.dependencies; // 若 fiber 属于一个 Consumer 组件，dependencies 上记录了 context 对象

    if (list !== null) {
      var dependency = list.firstContext; // 拿出第一个 context
      while (dependency !== null) {
        // Check if the context matches.
        if (dependency.context === context) {
          if (fiber.tag === ClassComponent) {
            var update = createUpdate(NoTimestamp, pickArbitraryLane(renderLanes));
            update.tag = ForceUpdate;
            enqueueUpdate(fiber, update);
          }
          // 标记组件存在更新，!includesSomeLane(renderLanes, updateLanes)
          fiber.lanes = mergeLanes(fiber.lanes, renderLanes);
          // 在上层 Fiber 树的节点上标记 childLanes 存在更新
          scheduleWorkOnParentPath(fiber.return, renderLanes);
          ...
          break
        }
      }
    }
  }
}
```

### 总结

React Context 实现的本质：
• 基于 Fiber 的依赖追踪（`Fiber.dependencies`）；
• 通过 `_currentValue` 实现全局共享状态；
• 更新时利用 Lane 标记机制确保精准更新；
• 函数组件通过 useContext 实时订阅 context 变更。

这种机制相比传统 `prop drilling `更加高效，但也要注意避免频繁传递对象引用（如 `{ a: 1 } !== { a: 1 }`），否则可能导致不必要的重渲染。

> ## 参考
>
> - [2023 再谈前端状态管理](https://mp.weixin.qq.com/s/F6UAmEP9VXEHNZz7VWwxbA)
> - [掘金小册 - 深入浅出 React 状态管理库](https://juejin.cn/book/7311970169411567626)
> - [从 0 实现 use-context-selector](https://juejin.cn/post/7197972831795380279)
