---
title: 'What is CSR, SSR, SSG, ISR'
date: '2023/04/25'
lastmod: '2023/04/27'
tags: [nextjs, ssr]
draft: false
summary: 'React 生态中，SSR 支持做得最好的可能是 Next.js，但 SSR 并不是Next.js的全部，只是其提供的预渲染支持之一。Next.js 还提供了 SSG、ISR、Streaming 的渲染方式，本文就从渲染方式方面来讲解，让我们可以更好地理解 Next.js。'
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

## 前言

React 生态中，SSR 支持做得最好的可能是 Next.js，但 SSR 并不是 Next.js 的全部，只是其提供的预渲染支持之一。Next.js 还提供了 SSG、ISR、Streaming 的渲染方式，本文就从渲染方式方面来讲解，让我们可以更好地理解 Next.js。

## CSR（Client Side Rendering）

CSR 即客户端渲染

### 缺点

1. **首次渲染，白屏时间过长**： 由于所有 JS 都打包在一个文件中，在这个 JS 加载完成之前，在页面上是看不到任何东西，这就会让用户感受到‘白屏’
2. **SEO 不友好**：对于搜索引擎来说，只能在页面中发现一个 DOM 节点，不利于 SEO；因为搜索引擎是不支持执行 JavaScript 代码的。

### SPA 和 MPA

常见的 CSR 方式又有单页面应用（SPA）和多页面应用（MPA）。其中 MPA 有更好的首屏性能，SPA 在后续页面的访问中有更好的性能和体验，但 SPA 也带来了更高的工程复杂度、略差的首屏性能和 SEO。这样就需要在不同的应用场景中做一些取舍。

## SSR（Server Side Rendering）

SSR 最早是为了解决单页应用（SPA）产生的 SEO、首屏渲染时间等问题而诞生的，在服务端直接实时同构渲染用户看到的页面，能最大程度上提高用户的体验，

简单的 SSR 实现可以参考：[vite 的 react ssr 模板](https://github.com/vitejs/vite-plugin-react/tree/main/playground/ssr-react)  
简化流程是：

1. 服务器端使用 renderToString 直接渲染出的页面信息为静态 html。
2. 客户端根据渲染出的静态 html 进行 hydrate，做一些绑定事件等操作。

在这个模板可以看出，若要使用 react 来实现服务端渲染，一般需要 3 个目录，工程配置比较繁琐。

- server： 包含 express 的后端工程
- client： 包含 react 的前端工程
- shared： 包含前后端公用的组件代码。

这就需要引入一些同构的 SSR 框架去简化这一些配置

### NextJS 的 SSR

Next.js 的 SSR 不同于纯服务端渲染，也拥有着如 SPA 一样快速渲染的能力。传统的服务端渲染只有 HTML 字符串，缺少交互

只需要在 Pages 目录下，如下这么写，Next.js 便会自动打包出前后端的代码，拥有 hydrate 的能力

```ts
import type { InferGetServerSidePropsType, GetServerSideProps } from 'next'

type Repo = {
  name: string
  stargazers_count: number
}

export const getServerSideProps = (async (context) => {
  const res = await fetch('https://api.github.com/repos/vercel/next.js')
  const repo = await res.json()
  return { props: { repo } }
}) satisfies GetServerSideProps<{
  repo: Repo
}>

export default function Page({
  repo,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return repo.stargazers_count
}
```

getServerSideProps 仅在服务器端运行，从不在浏览器上运行。如果页面使用 getServerSideProps ，我们需要注意：

- 当您直接请求此页面时， getServerSideProps 在请求时运行，并且此页面将使用返回的 props 进行预渲染
- 当您通过 next/link 或 next/router 在客户端页面转换上请求此页面时，Next.js 会向运行 getServerSideProps 的服务器发送 API 请求，并返回将用于呈现页面的 JSON

### 缺点

SSR 解决了白屏问题和 SEO 问题，但是也不是完美的：

1. 当请求量增大时，每次重新渲染增加了服务器的开销。
2. 需要等页面中所有接口请求完成才可以返回 html，虽不是白屏，但完成 hydrate 之前，页面也是不可操作。

## SSG（Static Site Generation）

静态站点生成。在构建时获取数据，生成静态页面，只需要静态部署，适合开发一些数据不易变更的网站，比如开发文档。

动态内容静态化:

- 如果动态内容与用户无关，那么可以提前静态化
- 通过 getStaticProps 可以获取数据
- 静态内容+数据(本地获取) 就得到了完整的页面
- 代替了之前的 静态内容+动态内容(AJAX 获取)

### SPA SEO 预渲染方案 Prerender SPA Plugin

在 Webpack4 环境下，SPA 项目可选择 prerender-spa-plugin 实现 SSG 功能

其原理是在 Webpack 构建阶段的最后，在本地启动一个 Puppeteer 的服务，访问配置了预渲染的路由，然后将 Puppeteer 中渲染的页面输出到 HTML 文件中，并建立路由对应的目录

但实测发现该插件并不兼容 Webpack5，且社区目前没有成熟的替代方案，因此感兴趣的同学可自行查阅相关说明，此处不再赘述。

### NextJS 的 SSG

#### 通过 getStaticProps()实现 SSG

比如文章列表页，要生成静态页面，在 Next.js 中代码如下：

<details>
    ```js
    import Link from 'next/link'

    export default function Page({ data }: PageProps) {
      return (
        <div>
          {data.map((item) => (
            <div key={item.id}>
              <Link href={`/blog/${item.id}`}>
                <a>{item.title}</a>
              </Link>
            </div>
          ))}
        </div>
      )
    }

    export const getStaticProps: GetStaticProps = async () => {
      const res = await fetch('https://localhost:3000/api/articles').then((res) => res.json())

      return {
        props: { data: res },
      }
    }
    ```

</details>

使用 getStaticProps 可以获得静态网页的数据，传递给 Page 函数，便可以生成静态页面。博客列表 URL 是固定的，那么不是固定 URL 的页面，要生成静态页面怎么办呢？比如博客详情页。

#### 通过 getStaticPaths()实现动态路由预渲染与 ISR

<details>
    ```js
    // pages/blog/[id].tsx
    export async function getStaticPaths() {
      const articles = await fetch('https://localhost:3000/api/articles').then((res) => res.json())
      return {
        paths: articles.map((p) => ({
          params: {
            id: p.id.toString(),
          },
        })),
        fallback: false,
      }
    }

    export const getStaticProps: GetStaticProps = async ({ params }) => {
      const res = await fetch(`https://localhost:3000/api/articles/${params.id}`).then((res) =>
        res.json()
      )

      return {
        props: { data: res },
      }
    }

    export default function Page({ data }: PageProps) {
      return (
        <div>
          <h1>{data.tltle}</h1>
          <div>{data.content}</div>
        </div>
      )
    }
    ```

</details>
我们可以使用 getStaticPaths 获得所有文章的路径，返回的paths 参数会传递给getStaticProps，在 getStaticProps中，通过 params 获得文章 id， Next.js 会在构建时，将paths 遍历生成所有静态页面。

SSG 的优点就是快，部署不需要服务器，任何静态服务空间都可以部署，而缺点也是因为静态，不能动态渲染，每添加一篇博客，就需要重新构建。

### 优缺点

优点: 就是快，部署不需要服务器，任何静态服务空间都可以部署

缺点: 也是因为静态，不能动态渲染，每添加一篇博客，就需要重新构建。这在网站内容变化频繁的情况下可能会导致生成时间较长，同时也可能会降低网站的性能。

## ISR（Incremental Static Regeneration）

增量静态再生。它是 SSG 和 SSR 的组合，主要是靠静态服务，但在数据过期时，可以再次从 API 获取数据，并且生成静态页面，最适合常见的资讯类、新闻类网站。

#### 轮询式刷新

简单来说就是类似 js setInterval 的方式按照一定是时间段刷新 server 端的构建

Nextjs：它比 SSG 方案只需要在 getStaticProps 函数中返回一个参数**revalidate**

```js
export const getStaticProps: GetStaticProps = async () => {
  const res = await fetch('https://localhost:3000/api/articles').then((res) => res.json())

  return {
    props: { data: res },
    // 当访问页面时，发现 20s 没有更新页面就会重新生成新的页面，但当前访问的还是已经生成的静态页面
    revalidate: 20,
  }
}
```

上面代码表示，当访问页面时，发现 20s 没有更新页面就会重新生成新的页面，但当前访问的还是已经生成的静态页面，也就是：是否重新生成页面，需要根据上一次的生成时间来判断，并且数据会延迟 1 次。

revalidate 会额外导致服务器性能开销，20s 生成一次页面是没必要的，比如一些博客网站和新闻网站，文章详情变更没那么频繁。

#### On-demand Revalidation（按需增量生成）

自从 next v12.2.0 开始支持按需增量生成
我们可以在 page 目录下新建一个 pages/api/revalidate.js 接口，用于触发增量生成。

```js
// pages/api/revalidate.js
export default async function handler(req, res) {
  // 设置一个秘钥用于检查，访问合法性
  if (req.query.secret !== process.env.MY_SECRET_TOKEN) {
    return res.status(401).json({ message: 'Invalid token' })
  }
  try {
    // path 为要触发的实际路径
    // e.g. for "/blog/[id]" this should be "/blog/5"
    await res.revalidate(req.query.path)
    return res.json({ revalidated: true })
  } catch (err) {
    return res.status(500).send('Error revalidating')
  }
}
```

比如我们在数据库中增加了 2 条数据，此时访问 `https://localhost:3000/api/revalidate?secret=<token>&path=/blog/5`，便可以触发，生成新的静态页面了。

##### 兜底策略

我们的静态页面在生成期间，如果用户访问对应路由会报错，这时需要有一个兜底策略来防止这种情况发生。

Nextjs 在组件中指定了 dynamicParams 的值（true 默认），当 dynamicParams 设置为 true 时，当请求尚未生成的路由段时，我们的页面将通过 SSR 这种方式（13 是 Streaming）来进行渲染。反之，Next.js 将在找不到请求的页面时返回 404 页面。

```js
export const dynamicParams = true
```

### 总结

对于 ISR 方案我们可以做一个切分：

1. 关键性的页面（如网站首页、热点数据等）预渲染为静态页面，缓存至 CDN，保证最佳的访问性能；
2. 非关键性的页面（如流量很少的老旧内容）先响应兜底页面，可以是 CSR，也可以是 SSR；同时对页面进行异步预渲染，之后缓存至 CDN，提升后续用户访问的性能。

![](/m-picture/what-is-csr-ssr-ssg-isr/isr.jpeg)
页面的更新遵循 stale-while-revalidate 的逻辑，即始终返回 CDN 的缓存数据（无论是否过期）；如果数据已经过期，那么触发异步的预渲染，异步更新 CDN 的缓存。
![](/m-picture/what-is-csr-ssr-ssg-isr/nextjs-isr.jpeg)

#### 缺点

1. 对于没有预渲染的页面，用户首次访问将会看到一个 fallback 页面，此时服务端才开始渲染页面，直到渲染完毕。这就导致用户体验上的不一致。

2. 对于已经被预渲染的页面，用户直接从 CDN 加载，但这些页面可能是已经过期的，甚至过期很久的，只有在用户刷新一次，第二次访问之后，才能看到新的数据。对于电商这样的场景而言，是不可接受的（比如商品已经卖完了，但用户看到的过期数据上显示还有）。

## 更好的方案

如何解决 ISR 的问题呢

- Netlify 方案：DPR + ESR

  - DPR（分布式的持续渲染），国内普及度极低，这边不展开讲
    <details>
    <summary>什么是 DPR</summary>
    ### DPR（分布式的持续渲染）
    分布式持久渲染（DPR）是 Netlify 提供的一种方便的渲染方法，可用于非常大的网站，以极大地缩短构建时间。您可以选择仅静态预生成最受欢迎和/或关键的页面，并使用 DPR 增强您的渲染策略，而不是预先构建整个站点。

    > [Distributed Persistent Rendering (DPR)](https://github.com/jamstack/jamstack.org/discussions/549)

    DPR 本质上讲，是对 ISR 的模型做了几处改动，并且搭配上 CDN 的能力：

    1. 去除了 fallback 行为，而是直接用 On-demand Builder（按需构建器）来响应未经过预渲染的页面，然后将结果缓存至 CDN；
    2. 数据页面过期时，不再响应过期的缓存页面，而是 CDN 回源到 Builder 上，渲染出最新的数据；
    3. 每次发布新版本时，自动清除 CDN 的缓存数据。

    ![](/m-picture/what-is-csr-ssr-ssg-isr/dpr.jpeg)

    在 Netlify 平台上，你可以像这样定义一个 Builder，用于预渲染或者实时渲染。这个 Builder 将会以 Serverless 云函数的方式在平台上运行：

    ```js
    const { builder } = require('@netlify/functions')

    async function handler(event, context) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html',
        },
        body: `
        <!DOCTYPE html>
          <html>
            <body>
              Hello World
            </body>
        </html>
        `,
      }
    }

    exports.handler = builder(handler)
    ```

    更多详细信息可以参考文档：`https://docs.netlify.com/configure-builds/on-demand-builders/`

    当然 DPR 还在很初期的阶段，就目前的讨论来看，依然有一些问题：

    1. 新页面的访问可能会触发 On-demand Builder 同步渲染，导致当次请求的响应时间比较长；
    2. 比较难防御 DoS 攻击，因为攻击者可能会大量访问新页面，导致 Builder 被大量并行地运行，这里需要平台方实现 Builder 的归一化和串行运行。
    </details>

  - 边缘渲染（ESR）。严格来说是站点的部署形态，使用了新一代的 CDN 技术和 Serverless，让动态网站也能够在边缘渲染，让用户享受到更佳的体验。

- 岛屿架构（Islands Architecture）。隔离交互组件，[astro](https://astro.build/)框架首打的特性。可以从我的另外一篇文章了解一下：[从 Astro 认识岛屿架构](/blog/islands-architecture)。
- 无注水（No hydration）。最快的注水，就是无注水 😄。这就是[qwik](https://qwik.builder.io/)框架的主要卖点。
- RSC（React Server component）。借助于 fiber 架构，React 能够打断传统递归式的注水，让网页拥有流式渲染的能力。

## RSC（React Server component）

Server component 是 React18 提供的能力， 与上面的 SSR 不同，相当于是流式 SSR。

传统 SSR 执行步骤：

1. 在服务器上，获取整个应用的数据。
2. 在服务器上，将整个应用程序数据渲染为 HTML 并发送响应。
3. 在浏览器上，加载整个应用程序的 JavaScript 代码。
4. 在客户端，将 JavaScript 逻辑连接到服务端返回的 HTML（这就是“水合”）。
   而以上每个步骤必须完成，才可以开始下一个步骤。

<details>
    <summary>比如一个传统的博客页面采用 SSR 的方式使用 getServerSideProps 的方式渲染，那么就需要等 3 个接口全部返回才可以看到页面。</summary>
    ```js
    export async function getServerSideProps() {
      const promises = {
        list: getBlogList(),
        detail: getBlogDetail(),
        comments: getComments()
      };

      const results = await Promise.allSettled(Object.values(promises));

      const props = Object.keys(promises).reduce((accumulator, key, index) => {
        if (results[index].status === 'fulfilled') {
          accumulator[key] = results[index].value;
        }
        return accumulator;
      }, {});

      return { props };
    }
    ```

</details>

![](/m-picture/what-is-csr-ssr-ssg-isr/nextjs12-blog.png)

如果评论接口返回较慢，那么整个程序就是待响应状态。

<details>
    <summary>我们可以在 Next.js 13 中开启 app 目录来，使用 Suspense开启流渲染的能力，将 Comments 组件使用 Suspense 包裹。</summary>
    ```js
    import { SkeletonCard } from '@/ui/SkeletonCard';
    import { Suspense } from 'react';
    import Comments from './Comments';

    export default function Posts() {
      return (
        <BlogList />
        <section>
        <BlogDetail />
          <Suspense
            fallback={
              <div className="w-full h-40 ">
                <SkeletonCard isLoading={true} />
              </div>
            }
          >
            <Comments />
          </Suspense>
        </section>
      );
    }
    ```

</details> 
<details>
    <summary>组件数据请求使用 use API，就可以实现流渲染了。</summary>
    ```js
    import { use } from 'react';

    async function fetchComment(): Promise<string> {
      return fetch('http://www.example.com/api/comments').then((res)=>res.json())
    }

    export default function Comments() {
      let data = use(fetchComment());
      return (
        <section>
          {data.map((item)=><Item key={item.id}/>)}
        </section>
      );
    }
    ```

</details>

整个渲染流程如下图:

![](/m-picture/what-is-csr-ssr-ssg-isr/rsc-blog.png)

- 灰色部分代表 HTML 字符串返回
- loading 状态表示当前部分还在请求
- 绿色部分代表注水成功，页面可以交互
  如图所示，如果评论部分接口还在请求中，那么页面左侧注水完成，也是可以交互可以点击的。

因此，Server component 解决了 SSR 中的 3 个问题：

1. 不必在服务器上返回所有数据才开始返回 html，相反我们可以先返回一个 HTML 结构，相当于骨架屏。
2. 不必等待所有 JavaScript 加载完毕才能开始补水。相反，我们可以利用代码拆分与服务器渲染结合使用，React 将在相关代码加载时对其进行水合。
3. 不必等待所有组件水合完成，页面才可以交互。

> ## 参考
>
> - [理解 Next.js 中的 CSR、SSR、SSG、ISR 以及 Streaming](https://juejin.cn/post/7162775935828115469)
> - [Webpack5 核心原理与应用实践/如何搭建 Vue 全栈开发环境/使用 Static Site Generation](https://juejin.cn/book/7115598540721618944/section/7116186197805760548)
> - [新一代 Web 技术栈的演进：SSR/SSG/ISR/DPR 都在做什么](https://zhuanlan.zhihu.com/p/369075411)
> - [Incremental Static Regeneration: Its Benefits and Its Flaws](https://www.netlify.com/blog/2021/03/08/incremental-static-regeneration-its-benefits-and-its-flaws)
> - [Netlify 提供的静态网站渲染和缓存技术](https://developer.aliyun.com/article/1260071)
> - [卷起来，前端建站 SSG，SSR，ISR，Hydration, Island...一网打尽](https://hicc.pro/p/blog/ssg-ssr-isr-hydration)
