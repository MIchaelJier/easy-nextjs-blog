---
title: '模块联邦（MF）——目前最好的跨应用代码共享方式'
date: '2022/4/18'
lastmod: '2022/5/10'
tags: [微前端, MF]
draft: false
summary: 'Webpack5 模块联邦让 Webpack 达到了线上 Runtime 的效果，让代码直接在项目间利用 CDN 直接共享，不再需要本地安装 Npm 包、构建再发布了'
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

## 引言：

&emsp;先说结论：Webpack5 模块联邦让 Webpack 达到了线上 Runtime 的效果，让代码直接在项目间利用 CDN 直接共享，不再需要本地安装 Npm 包、构建再发布了！<br/>
&emsp;我们知道 Webpack 可以通过 DLL 或者 Externals 做代码共享时 Common Chunk，但不同应用和项目间这个任务就变得困难了，我们几乎无法在项目之间做到按需热插拔。<br/>

## 共享模块的方案

![](//www.michaeljier.cn/m-picture/module-federation/M.png)

### 其他方案

1. NPM  
   正常的代码共享需要将依赖作为 Lib 安装到项目，进行 Webpack 打包构建再上线（如上图左上）<br/>
   对于项目 Home 与 Search，需要共享一个模块时，最常见的办法就是将其抽成通用依赖并分别安装在各自项目中。<br/>
   虽然 Monorepo 可以一定程度解决重复安装和修改困难的问题，但依然**需要走本地编译，并且依赖的包存在冗余。**
2. 远程组件（即 UMD）  
   真正 Runtime 的方式可能是 UMD 方式共享代码模块，即将模块用 Webpack UMD 模式打包，并输出到其他项目中。（如上图右上）<br/>
   对于项目 Home 与 Search，直接利用 UMD 包复用一个模块。但这种技术方案问题也很明显，就是**包体积无法达到本地编译时的优化效果，且库之间容易冲突。**
3. 微前端 (MFE)  
   微前端：micro-frontends (MFE) 也是最近比较火的模块共享管理方式，微前端就是要解决多项目并存问题，多项目并存的最大问题就是模块共享，不能有冲突。（如上图左下）<br/>
   由于微前端还要考虑样式冲突、生命周期管理。聚焦在资源加载方式上，微前端一般有两种打包方式：<br/>
   &emsp;**i. 子应用独立打包，模块更解耦，但无法抽取公共依赖等。**<br/>
   &emsp;**ii. 整体应用一起打包，很好解决上面的问题，但打包速度实在是太慢了，不具备水平扩展能力。** <br/>
   所以，MFE 对于公共依赖加载目前并没有非常好的解决方案
   > MF + qiankun 的方案可以参考：[微前端在得物客服域的技术实践](https://juejin.cn/post/7105958711445127176#heading-2)

### MF

&emsp;模块联邦是 Webpack5 推出的一个新的重要功能，可以真正意义上实现让跨应用间做到模块共享，解决了从前用 NPM 公共包方式共享的不便利，同时也可以作为微前端的落地方案。<br/>
&emsp;从图中（上图右下）可以看到，这个方案是直接将一个应用的包应用于另一个应用，同时具备整体应用一起打包的公共依赖抽取能力。<br/>
&emsp;让应用具备模块化输出能力，其实开辟了一种新的应用形态，即 “中心应用”，这个中心应用用于在线动态分发 Runtime 子模块，并不直接提供给用户使用：<br/>
![](//www.michaeljier.cn/m-picture/module-federation/mid-app.png)
&emsp;对微前端而言，这张图就是一个完美的主应用，因为所有子应用都可以利用 Runtime 方式复用主应用的 Npm 包和模块，更好的集成到主应用中。<br/>
&emsp;与 qiankun 等微前端架构不同的另一点是，我们一般都是需要一个中心基座去控制微应用的生命周期，而 Module Federation 则是去中心化的，没有中心基座的概念，每一个模块或者应用都是可以导入或导出，跨项目模块的互相引用就变得十分简单了，而基座模式就可能需要提升到每个父应用去做全局共享管理。

## 基本使用

### API

> [前往完整 ts 定义](https://github.com/webpack/webpack/blob/149333f210cc003d62572eb189135b1daedddc1f/declarations/plugins/container/ModuleFederationPlugin.d.ts)

```js
export interface ModuleFederationPluginOptions {
  /**
   * Modules that should be exposed by this container. When provided, property name is used as public name, otherwise public name is automatically inferred from request.
   * 表示作为 Remote 时，export 哪些属性提供给 Host 消费
   */
  exposes?: Exposes;
  /**
   * The filename of the container as relative path inside the `output.path` directory.
   */
  filename?: string;
  /**
   * Options for library.
   */
  library?: LibraryOptions;
  /**
   * The name of the container.
   */
  name?: string;
  /**
   * The external type of the remote containers.
   */
  remoteType?: ExternalsType;
  /**
   * Container locations and request scopes from which modules should be resolved and loaded at runtime. When provided, property name is used as request scope, otherwise request scope is automatically inferred from container location.
   * 示作为 Host 时，去消费哪些 Remote
   */
  remotes?: Remotes;
  /**
   * The name of the runtime chunk. If set a runtime chunk with this name is created or an existing entrypoint is used as runtime.
   */
  runtime?: EntryRuntime;
  /**
   * Share scope name used for all shared modules (defaults to 'default').
   */
  shareScope?: string;
  /**
   * Modules that should be shared in the share scope. When provided, property names are used to match requested modules in this compilation.
   * 可以让远程加载的模块对应依赖改为使用本地项目的 vue，换句话说优先用 Host 的依赖，如果 Host 没有，最后再使用自己的
   */
  shared?: Shared;
  /*  shared: {
        'my-vue': {
          // can be referenced by import "my-vue"
          import: 'vue', // the "vue" package will be used as a provided and fallback module
          shareKey: 'shared-vue', // under this name the shared module will be placed in the share scope
          shareScope: 'default', // share scope with this name will be used
          singleton: true, // only a single version of the shared module is allowed
          strictVersion: true, // don't use shared version when version isn't valid. Singleton or modules without fallback will throw, otherwise fallback is used
          version: '1.2.3', // the version of the shared module
          requiredVersion: '^1.0.0', // the required version of the shared module
        },
    } */
}
```

### 使用

> [前往 examples](https://github.com/module-federation/module-federation-examples)

- <details>
    <summary>app1 配置</summary>
    ```js
      const HtmlWebpackPlugin = require("html-webpack-plugin");
      const { ModuleFederationPlugin } = require("webpack").container; // 通过使用webpack内置插件构建模块

      module.exports = (env = {}) => ({
        // 其它 webpack 配置...
        plugins: [
          new ModuleFederationPlugin({
            name: "app1", // 当前应用的名称，需要全局维一
            filename: "remoteEntry.js", // 共享模块的入口文件
            library: { type: 'var', name: 'app1' }, // 共享模块的全局引用
            exposes: { // 导出的模块，只有在此申明的模块才可以作为远程依赖被使用
              "./Button": "./src/components/Button",
            },
            shared: ['vue', 'element-ui'] // 远程加载的模块对应的依赖使用本地项目的依赖
          }),
          new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "./public/index.html"),
          })
        ],

        devServer: {
          port: 3001,
        }
      });
      ```

   </details>

- <details>
    <summary>app2配置</summary>
    ```js
    const HtmlWebpackPlugin = require("html-webpack-plugin");
    const { ModuleFederationPlugin } = require("webpack").container; // 通过使用webpack内置插件构建模块

  module.exports = (env = {}) => ({
  // 其它 webpack 配置...
  plugins: [
  new ModuleFederationPlugin({
  name: 'app2',
  filename: "remoteEntry.js",
  remotes: { // 引入远程应用的导出的模块， name@host address/filename.
  app1: 'app1@http://localhost:3001/remoteEntry.js'
  },
  shared: ['vue', 'element-ui'] // 抽离的依赖与其它应用保持一致
  }),
  new HtmlWebpackPlugin({
  template: path.resolve(\_\_dirname, "./public/index.html"),
  })
  ],
  });
  ```
   </details>

## 原理分析

### 异步模块原理

我们复习下 Webpack v4 中的异步模块的原理：

1. import(chunkId) => **webpack_require**.e(chunkId) 将相关的请求回调存入 installedChunks。

```js
// import(chunkId) => __webpack_require__.e(chunkId)
__webpack_require__.e = function (chunkId) {
  return new Promise((resolve, reject) => {
    var script = document.createElement('script')
    script.src = jsonpScriptSrc(chunkId)
    var onScriptComplete = function (event) {
      // ...
    }
    var timeout = setTimeout(function () {
      onScriptComplete({ type: 'timeout', target: script })
    }, 120000)
    script.onerror = script.onload = onScriptComplete
    document.head.appendChild(script)
  })
}
```

2. 发起 JSONP 请求
3. 将下载的模块录入 modules
4. 执行 chunk 请求回调
5. 加载 module
6. 执行用户回调

&emsp;联邦模块是基于 webpack 做的优化，所以在深入联邦模块之前我们首先得知道 webpack 是怎么做的打包工作。
webpack 每次打包都会将资源全部包裹在一个立即执行函数里面，这样虽然避免了全局环境的污染，但也使得外部不能访问内部模块。
在这个立即执行函数里面，webpack 使用 webpack_modules 对象保存所有的模块代码，然后用内部定义的 webpack_require 方法从 webpack_modules 中加载模块。并且在异步加载和文件拆分两种情况下向全局暴露一个 webpackChunk 数组用于沟通多个 webpack 资源，这个数组通过被 webpack 重写 push 方法，会在其他资源向 webpackChunk 数组中新增内容时同步添加到 webpack_modules 中从而实现模块整合。
联邦模块就是基于这个机制，修改了 webpack_require 的部分实现，在 require 的时候从远程加载资源，缓存到全局对象`window["webpackChunk"+appName]` 中，然后合并到 webpack_modules 中。

### 模块联邦实现原理

#### 主流程

源码中 ModuleFederationPlugin 主流程 主要做了三件事：

通过参数是否配置 shared 来判断是否使用共享依赖 SharePlugin 模块。
通过参数是否配置 exposes 来判断是否使用公开 ContainerPlugin 模块。
通过参数是否配置 remotes 来判断是否使用 ContainerReferencePlugin 引用模块。

下面是项目源码，部分代码以及判断条件已省略。

```js
// 源码目录 lib/container/ModuleFederationPlugin
class ModuleFederationPlugin {
  ...
	apply(compiler) {
		if (library && ...) {
			compiler.options.output.enabledLibraryTypes.push(library.type);
		}
		compiler.hooks.afterPlugins.tap("ModuleFederationPlugin", () => {
			if (options.exposes && ...) {
				new ContainerPlugin({
					...
				}).apply(compiler);
			}
			if (options.remotes && ...) {
				new ContainerReferencePlugin({
					remoteType,
					remotes: options.remotes
				}).apply(compiler);
			}
			if (options.shared) {
				new SharePlugin({
					shared: options.shared,
					shareScope: options.shareScope
				}).apply(compiler);
			}
		});
	}
}

module.exports = ModuleFederationPlugin;
```

#### webpack5 模块联邦对异步模块加载的处理

> [具体流程：Webpack5 模块联邦原理](https://github.com/Vincent0700/learning-webpack/blob/master/docs/Webpack%E6%A8%A1%E5%9D%97%E8%81%94%E9%82%A6%E5%8E%9F%E7%90%86.md)

场景：app1 暴露了一个模块 say 出去，然后 app2 想要去调用它

1. **下载并执行 remoteEntry.js，挂载入口点对象到 window.app1，他有两个函数属性，init 和 get。init 方法用于初始化作用域对象 initScope，get 方法用于下载 moduleMap 中导出的远程模块。**
2. **加载 app1 到本地模块**
3. **创建 app1.init 的执行环境，收集依赖到共享作用域对象 shareScope**
4. **执行 app1.init，初始化 initScope**
5. **用户 import 远程模块时调用 app1.get(moduleName) 通过 Jsonp 懒加载远程模块，然后缓存在全局对象 window['webpackChunk' + appName]**
6. **通过 webpack_require 读取缓存中的模块，执行用户回调**

## 参考文档

1. [webpack-5-module-federation-a-game-changer-in-javascript-architecture](https://indepth.dev/posts/1173/webpack-5-module-federation-a-game-changer-in-javascript-architecture#its-important-to-note-these-are-special-entry-points-they-are-only-a-few-kb-in-size-containing-a-special-webpack-runtime-that-can-interface-with-the-host-it-is-not-a-standard-entry-point--7/)
2. [微前端模块共享你真的懂了吗](https://juejin.cn/post/6984682096291741704)
3. [Webapck 官方文档：Module Federation](https://webpack.js.org/plugins/module-federation-plugin/)
4. [模块联邦浅析--政采云前端团队](https://juejin.cn/post/7101457212085633054)
5. [Webpack5 模块联邦原理](https://github.com/Vincent0700/learning-webpack/blob/master/docs/Webpack%E6%A8%A1%E5%9D%97%E8%81%94%E9%82%A6%E5%8E%9F%E7%90%86.md)
