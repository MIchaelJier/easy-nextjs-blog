---
title: '在 React 中使用 Shadow DOM'
date: '2022/3/07'
lastmod: '2022/3/07'
tags: [Shadow DOM]
draft: false
summary: 'Shadow DOM 是什么？在 React 中如何应用 Shadow DOM？直接操作 DOM => ReactDOM.render=> ReactDOM.createPortal '
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

## Shadow DOM 是什么

Shadow DOM 允许在文档（Document）渲染时插入一棵「子 DOM 树」，并且这棵子树不在主 DOM 树中，同时为子树中的 DOM 元素和 CSS 提供了封装的能力。Shadow DOM 使得子树 DOM 与主文档的 DOM 保持分离，子 DOM 树中的 CSS 不会影响到主 DOM 树的内容，如下图所示：
![](//www.michaeljier.cn/m-picture/shadow-dom/shadow-tree.png)

> 这里有几个需要了解和 Shadow DOM 相关的技术概念：  
> `Shadow host`： 一个常规 DOM 节点，Shadow DOM 会被附加到这个节点上。  
> `Shadow tree`：Shadow DOM 内部的 DOM 树。  
> `Shadow boundary`：Shadow DOM 结束的地方，也是常规 DOM 开始的地方。  
> `Shadow root`: Shadow tree 的根节点。

## Shadwo DOM 有何用

1. 浏览器内建的原生组件：`input`，`video`，还有 `textarea`，`select`，`audio` 等
2. Web Components
3. 其他需要 DOM/CSS 隔离的场景

## 如何创建 Shadow DOM

```js
const shadowroot = element.attachShadow(shadowRootInit)
```

```html
<html>
  <head>
    <title>Shadow Demo</title>
  </head>
  <body>
    <h1>Shadow Demo</h1>
    <div id="host"></div>
    <script>
      const host = document.querySelector('#host')
      // 通过 attachShadow 向元素附加 Shadow DOM
      const shodowRoot = host.attachShadow({ mode: 'open' })
      // 向 shodowRoot 中添加一些内容
      shodowRoot.innerHTML = `<style>*{color:red;}</style><h2>haha!</h2>`
    </script>
  </body>
</html>
```

`Element.attachShadow` 的参数 `shadowRootInit` 的 `mode` 选项用于设定「封装模式」。它有两个可选的值 ：

- "open" ：可 Host 元素上通过 `host.shadowRoot` 获取 `shadowRoot` 引用，这样任何代码都可以通过 shadowRoot 来访问的子 DOM 树。
- "closed"：在 Host 元素上通过 `host.shadowRoot` 获取的是 `null`，我们只能通过 `Element.attachShadow` 的返回值拿到 `shadowRoot` 的引用（通常可能隐藏在类中）。例如，浏览器内建的 `input`、`video` 等就是关闭的，我们没有办法访问它们。

## 哪些元素可以附加 Shadow DOM

```
 +----------------+----------------+----------------+
 |    article     |      aside     |   blockquote   |
 +----------------+----------------+----------------+
 |     body       |       div      |     footer     |
 +----------------+----------------+----------------+
 |      h1        |       h2       |       h3       |
 +----------------+----------------+----------------+
 |      h4        |       h5       |       h6       |
 +----------------+----------------+----------------+
 |    header      |      main      |      nav       |
 +----------------+----------------+----------------+
 |      p         |     section    |      span      |
 +----------------+----------------+----------------+
```

## 兼容性

![](//www.michaeljier.cn/m-picture/shadow-dom/compatibility.png)

## 在 React 中如何应用 Shadow DOM

在基于 React 的项目中应该如何使用 Shadow DOM 呢？比如你正在基于 React 编写一个面向不同产品或业务，可嵌入集成使用的公共组件，比如你正在基于 React 做一个「微前端架构」应用的设计或开发。
我们在编写 React 应用时一般不希望到处是 DOM 操作，因为这很不 React (形容词)。那是否能封装成一下用更 React (形容词) 的组件风格去使用 Shadow DOM 呢?

### 1. 初步尝试

```js
import React from 'react'
import ReactDOM from 'react-dom'

export class ShadowView extends React.Component {
  attachShadow = (host: Element) => {
    host.attachShadow({ mode: 'open' })
  }
  render() {
    const { children } = this.props
    return <div ref={this.attachShadow}>{children}</div>
  }
}

export function App() {
  return (
    <ShadowView>
      <span>这儿是隔离的</span>
    </ShadowView>
  )
}

ReactDOM.render(<App />, document.getElementById('root'))
```

跑起来看看效果，一定会发现「咦？什么也没有显示」：
![](//www.michaeljier.cn/m-picture/shadow-dom/demo1.png)
在这里需要稍注意一下，在一个元素上附加了 Shadow DOM 后，元素原本的「子元素」将不会再显示，并且这些子元素也不在 Shadow DOM 中，只有 host.shadowRoot 的子元素才是「子 DOM 树」中一部分。也就是说这个「子 DOM 树」的「根节点」是 host.shadowRoot 而非 host。 host.shadowRoot 是 ShadowRoot 的实例，而 ShadowRoot 则继承于 DocumentFragment，可通过原生 DOM API 操作其子元素。

我们需通过 Element.attachShadow 附加到元素，然后就能拿到附加后的 ShadowRoot 实例。 针对 ShadowRoot 这样一个原生 DOM Node 的的引用，除了利用 ReactDOM.render 或 ReactDOM.createPortal ，我们并不能轻易的将 React.Element 渲染到其中，除非直接接操作 DOM。

### 2. 基于直接操作 DOM 改造一版

在 React 中通过 ref 拿到真实的 DOM 引用后，是否能通过原生的 DOM API，将 host 的 children 移动到 host.shadowRoot 中？

```js
import React from 'react'
import ReactDOM from 'react-dom'

// 基于直接操作 DOM 的方式改造的一版
export class ShadowView extends React.Component {
  attachShadow = (host: Element) => {
    const shadowRoot = host.attachShadow({ mode: 'open' })
    //将所有 children 移到 shadowRoot 中
    ;[].slice.call(host.children).forEach((child) => {
      shadowRoot.appendChild(child)
    })
  }
  render() {
    const { children } = this.props
    return <div ref={this.attachShadow}>{children}</div>
  }
}

// 验证一下
export class App extends React.Component {
  state = { message: '...' }
  onBtnClick = () => {
    this.setState({ message: 'haha' })
  }
  render() {
    const { message } = this.state
    return (
      <div>
        <ShadowView>
          <div>{message}</div>
          <button onClick={this.onBtnClick}>内部单击</button>
        </ShadowView>
        <button onClick={this.onBtnClick}>外部单击</button>
      </div>
    )
  }
}

ReactDOM.render(<App />, document.getElementById('root'))
```

在浏览器中看看效果，可以看到是可以正常显示的。但与此同时会发现一个问题「隔离在 ShadowRoot 中的元素上的事件无法被触发了」，这是什么原因呢？

是由于 React 的「合成事件机制」的导致的，我们知道在 React 中「事件」并不会直接绑定到具体的 DOM 元素上，而是通过在 document 上绑定的 ReactEventListener 来管理， 当时元素被单击或触发其他事件时，事件被 dispatch 到 document 时将由 React 进行处理并触发相应合成事件的执行。

那为什么合成事件在 Shadow DOM 中不能被正常触发？是因为当在 Shadow DOM 外部捕获时浏览器会对事件进行「重定向」，也就是说在 Shadow DOM 中发生的事件在外部捕获时将会使用 host 元素作为事件源。这将让 React 在处理合成事件时，不认为 ShadowDOM 中元素基于 JSX 语法绑定的事件被触发了。

![](//www.michaeljier.cn/m-picture/shadow-dom/demo2.png)

### 3. 尝试利用 ReactDOM.render 改造一下

ReactDOM.render 的第二个参数，可传入一个 DOM 元素。那是不是能通过 ReactDOM.render 将 React Eements 渲染到 Shodaw DOM 中呢？看一下如下尝试：

```js
import React from 'react'
import ReactDOM from 'react-dom'

// 换用 ReactDOM.render 实现
export class ShadowView extends React.Component {
  attachShadow = (host: Element) => {
    const { children } = this.props
    const shadowRoot = host.attachShadow({ mode: 'open' })
    ReactDOM.render(children, shadowRoot)
  }
  render() {
    return <div ref={this.attachShadow}></div>
  }
}

// 试试效果如何
export class App extends React.Component {
  state = { message: '...' }
  onBtnClick = () => {
    this.setState({ message: 'haha' })
    alert('haha')
  }
  render() {
    const { message } = this.state
    return (
      <ShadowView>
        <div>{message}</div>
        <button onClick={this.onBtnClick}>单击我</button>
      </ShadowView>
    )
  }
}

ReactDOM.render(<App />, document.getElementById('root'))
```

可以看到通过 ReactDOM.render 进行 children 的渲染，是能够正常渲染到 Shadow Root 中，并且在 Shadow DOM 中合成事件也是能正常触发执行的。

为什么此时「隔离在 Shadow DOM 中的元素事件」能够被触发了呢？ 因为在 Reac 在发现渲染的目标在 ShadowRoot 中时，将会将事件绑定在通过 Element.getRootNode() 获取的 DocumentFragment 的 RootNode 上。

![](//www.michaeljier.cn/m-picture/shadow-dom/demo3.png)

看似一切顺利，但却会发现父组件的 state 更新时，而 ShadowView 组件并没有更新。如上边的示例，其中的 message 显示的还是旧的，而原因就在我们使用 ReactDOM.render 时，Shadow DOM 的元素和父组件不在一个 React 渲染上下文中了。

### 4. 利用 ReactDOM.createPortal 实现一版

我们知道 createPortal 的出现为「弹窗、提示框」等脱离文档流的组件开发提供了便利，替换了之前不稳定的 API unstable_renderSubtreeIntoContainer。

ReactDOM.createPortal 有一个特性是「通过 createPortal 渲染的 DOM，事件可以从 Portal 的入口端冒泡上来」，这一特性很关键，没有父子关系的 DOM ，合成事件能冒泡过来，那通过 createPortal 渲染到 Shadow DOM 中的元素的事件也能正常触发吧？并且能让所有元素的渲染在一个上下文中。那就基于 createPortal 实现一下：

```js
import React from 'react'
import ReactDOM from 'react-dom'

// 利用 ReactDOM.createPortal 的实现
export function ShadowContent({ root, children }) {
  return ReactDOM.createPortal(children, root)
}

export class ShadowView extends React.Component {
  state = { root: null }
  setRoot = (eleemnt) => {
    const root = eleemnt.attachShadow({ mode: 'open' })
    this.setState({ root })
  }
  render() {
    const { children } = this.props
    const { root } = this.state
    return (
      <div ref={this.setRoot}>{root && <ShadowContent root={root}>{children}</ShadowContent>}</div>
    )
  }
}

// 试试如何
export class App extends React.Component {
  state = { message: '...' }
  onBtnClick = () => {
    this.setState({ message: 'haha' })
  }
  render() {
    const { message } = this.state
    return (
      <ShadowView>
        <div>{message}</div>
        <button onClick={this.onBtnClick}>单击我</button>
      </ShadowView>
    )
  }
}

ReactDOM.render(<App />, document.getElementById('root'))
```

![](//www.michaeljier.cn/m-picture/shadow-dom/demo4.png)
Wow! 一切正常，有一个小问题是 createPortal 不支持 React 16 以下的版本，但大多数情况下这并不是个什么大问题。
