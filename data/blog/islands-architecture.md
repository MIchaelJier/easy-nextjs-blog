---
title: '从Astro认识岛屿架构'
date: '2023/04/27'
lastmod: '2023/04/27'
tags: [ssr, islands-architecture, astro]
draft: false
summary: '岛屿架构(Islands Architecture) 如今已经不是新鲜的概念了，社区上已经有了较多成熟的方案。这其中的典型代表是 Astro。'
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

岛屿架构(Islands Architecture) 如今已经不是新鲜的概念了，社区上已经有了较多成熟的方案。

概览图：

![](//www.michaeljier.cn/m-picture/islands-architecture/overview-map.png)

这其中的典型代表是 Astro。Astro 对岛屿架构的解释，也非常直观：

> Astro 群岛“指的是静态 HTML 中的交互性的 UI 组件。一个页面上可以有多个岛屿，并且每个岛屿都被独立呈现。你可以将它们想象成在一片由静态（不可交互）的 HTML 页面中的动态岛屿。

从上面这句话的定义中可以提炼一些要点：

- 静态 HTML。
- 交互性的 UI 组件。
- 多个岛屿，支持独立呈现。

为了解析这些要点，我们还是得简单了解一下 Astro 这个框架的特性。

Astro 宣称自己是 ‘zero-JS frontend architecture’，即 Astro 在服务端渲染静态 HTML，客户端中不需要加载额外的 JS 就能完整呈现内容。

## Astro 简单使用

写一个简单 DEMO 试试：

React 组件：

```js
import { useState } from 'react'

export const Counter = () => {
  const [count, setCount] = useState(0)

  return <div onClick={() => setCount((i) => i + 1)}>click me to increment: {count}</div>
}
```

Astro 文件：

```js
---
import Layout from '../layouts/Layout.astro';
import Card from '../components/Card.astro';
import { Counter } from '../components/Counter';
---

<Layout title="Welcome to Astro.">
  <main>
    <Counter />
    <ul role="list" class="link-card-grid">
      <Card
        href="https://docs.astro.build/"
        title="Documentation"
        body="Learn how Astro works and explore the official API docs."
      />
      <Card
        href="https://astro.build/integrations/"
        title="Integrations"
        body="Supercharge your project with new frameworks and libraries."
      />
    </ul>
  </main>
</Layout>

<style>
  ...;
</style>
```

![](//www.michaeljier.cn/m-picture/islands-architecture/astro-demo.png)

这语法，astro 集大家之所长，吸取了 Vue SFC 和 React 的 JSX, 还有 MDX。

### 如何交互

然而，这个有别于典型的 SSR 框架。SSR 也是在服务端渲染完整 HTML 树，但是在客户端依然需要加载完整的视图框架代码，然后进行水合(Hydration)，才能让页面变得可交互:

![](//www.michaeljier.cn/m-picture/islands-architecture/hydrate.png)

那 Astro 没有 JS，显然是无法与用户进行动态交互的。Astro 的解决办法就是 岛屿架构, 我们只需将需要动态交互的页面模块声明为岛屿，如下图，页头和图片轮播就是可交互的岛屿。

![](//www.michaeljier.cn/m-picture/islands-architecture/island.png)

现在将 React 组件声明为岛屿：

```js
---
import Layout from '../layouts/Layout.astro';
import Card from '../components/Card.astro';
import { Counter } from '../components/Counter';
---

<Layout title="Welcome to Astro.">
  <main>
-    <Counter/>
+    <Counter client:load />
    <ul role="list" class="link-card-grid">
      <Card
        href="https://docs.astro.build/"
        title="Documentation"
        body="Learn how Astro works and explore the official API docs."
      />
      <Card
        href="https://astro.build/integrations/"
        title="Integrations"
        body="Supercharge your project with new frameworks and libraries."
      />
    </ul>
  </main>
</Layout>
```

我们只需将对应的 React 组件加上 client:load 指令，Astro 就是将其识别为岛屿，该 React 组件的代码及其相关依赖会被打包到一起，在客户端端加载和水合。

![](//www.michaeljier.cn/m-picture/islands-architecture/astro-demo-2.png)

现在我们的 Counter 组件在客户端就是一个可交互的状态了。Astro 基本上没有什么上手门槛，建议读者自己玩一下。有机会再展开讲一下它的实现原理。

有了‘岛屿’赋能的 Astro 架构：

![](//www.michaeljier.cn/m-picture/islands-architecture/astro-hydrate.png)

Astro 在服务端渲染完整的 HTML 树，然后在客户端中按需加载岛屿代码，并进行水合。看起来有点像微前端、或者 iframe 这样的机制。

### 现在来回顾一下开头提到的 ‘要点’

|                        | 岛屿架构                               | SSR + CSR                                                                                                               | CSR                   |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 静态 HTML              | 静态 HTML 优先，无 JavaScript          | 服务端渲染 HTML 初始内容, 包含完整的客户端副本                                                                          | 完全在客户端加载渲染  |
| 交互性的 UI 组件       | 默认完全静态，通过岛屿局部增强可交互性 | 全局可交互                                                                                                              | 全局可交互            |
| 多个岛屿，支持独立呈现 | 岛屿之间互相独立，可以独立加载和交互   | 完整加载。可以通过代码分块 + [progressive-hydration](https://www.patterns.dev/posts/progressive-hydration) 实现按需加载 | progressive-hydration |

## 岛屿架构的优势

岛屿架构非常适合以内容为中心的网站，比如博客，文档网站，新闻网站等等。在 Astro 的定位非常清晰，它把站点类型分为两种：

- 内容为中心 → 也称为 网站 → Astro 擅长
- 交互为中心的 → 也称为 Web 应用程序 → 应该使用 Next.js 或者 Nuxt.js 这样的框架

在岛屿架构擅长的场景中，Astro 给出了比较：

- [Astro vs. SPA (Next.js)](https://twitter.com/t3dotgg/status/1437195415439360003) - 94% less JavaScript
- [Astro vs. SPA (Next.js)](https://twitter.com/jlengstorf/status/1442707241627385860?lang=en) - 34% 更快地加载
- [Astro vs. SPA (Next.js)](https://vanntile.com/blog/next-to-astro) – 65% 网络使用减少
- [Astro vs. SPA (Remix, SvelteKit)](https://www.youtube.com/watch?v=2ZEMb_H-LYE&t=8163s) - “这令人置信的 Google Lighthouse 分数”
- [Astro vs. Qwik](https://www.youtube.com/watch?v=2ZEMb_H-LYE&t=8504s) - 43% 更快的 TTI

## 小结

岛屿架构本身概念并不复杂，是前端框架和工程化发展的一个阶段性质变结果。  
前后端分离(分工上)还是不变的趋势，相比传统的 MPA ，岛屿架构更加现代化，拥有更好的开发体验。  
相比 SPA，岛屿架构在以内容为中心的场景下，优势也非常明显。

> ## 参考
>
> - [Islands Architecture](https://www.patterns.dev/posts/islands-architecture)
> - [Islands Architecture](https://jasonformat.com/islands-architecture/)
> - [Rendering on the Web: Performance Implications of Application Architecture](https://www.youtube.com/watch?v=k-A2VfuUROg)
> - [Is 0kb of JavaScript in your Future?](https://dev.to/this-is-learning/is-0kb-of-javascript-in-your-future-48og)
