---
title: '深入 tailwindcss'
date: '2023/01/09'
lastmod: '2023/01/09'
tags: [tailwindcss, css]
draft: false
summary: 'Tailwind CSS的工作原理是扫描所有HTML文件、JavaScript组件和任何其他模板的类名，生成相应的样式，然后将它们写入静态CSS文件'
images: ['/static/images/16350881224248.jpg']
layout: PostLayout
---

核心特点：**功能类优先（utility-first）**  
Tailwind CSS 的工作原理是扫描所有 HTML 文件、JavaScript 组件和任何其他模板的类名，生成相应的样式，然后将它们写入静态 CSS 文件。

本质上讲 TaiWindCss 是一个 postCss 的插件，首先我们需要了解一下 postcss

## postCSS

### 什么是 postCSS

postCss 就是一个开发工具，是一个用 JavaScript 工具和插件转换 CSS 代码的工具。支持变量，混入，未来 CSS 语法，内联图像等等

### 比较流行的插件工具

Autoprefixer（浏览器兼容，自动补齐前缀） 、Stylelint（CSS 代码检查器） 、CSSnano（体积优化）

### 工作流

```js
CSS => Parse => Plugin 1 => Plugin 2 => ... => Stringifier => New CSS
```

1. 通过 fs 读取 CSS 文件
2. 通过 parser 将 CSS 解析成抽象语法树(AST 树)
3. 将 AST 树”传递”给任意数量的插件处理
4. 诸多插件进行数据处理。插件间传递的数据就是 AST 树
5. 通过 stringifier 将处理完毕的 AST 树重新转换成字符串

### 关键的处理机制

> Source string → Tokenizer → Parser → AST → Processor → Stringifier

#### Tokenizer

将源 css 字符串进行分词

<details>
    <summary>对`.className { color: #FFF; }`进行分词</summary>
    ```js
    .className { color: #FFF; }
    ```
    通过Tokenizer后结果如下：
    ```js
    [
        ["word", ".className", 1, 1, 1, 10]
        ["space", " "]
        ["{", "{", 1, 12]
        ["space", " "]
        ["word", "color", 1, 14, 1, 18]
        [":", ":", 1, 19]
        ["space", " "]
        ["word", "#FFF" , 1, 21, 1, 23]
        [";", ";", 1, 24]
        ["space", " "]
        ["}", "}", 1, 26]
    ]
    ```
    以word类型为例，参数如下：
    ```js
    const token = [
        // token 的类型，如word、space、comment
        'word',

        // 匹配到的词名称
        '.className',

        // 代表该词开始位置的row以及column，但像 type为`space`的属性没有该值
        1, 1,

        // 代表该词结束位置的row以及column，
        1, 10
    ]
    ```

</details>
#### Parser
经过Tokenizer之后，需要Parser将结果初始化为AST
```js
this.root = {
    type: 'root',
    source: { input: {css: ".className { color: #FFF; }", hasBOM: false, id: "<input css 1>"},
                  start: { line: 1, column: 1 } ,
                  end: { line: 1, column: 27 }
    },
  raws:{after: "", semicolon: false}
  nodes // 子元素
}
```
#### Processor
经过AST之后，PostCSS提供了大量JS API给插件用
#### Stringifier
插件处理后，比如加浏览器前缀，会被重新Stringifier.stringify为一般CSS。

从上述内容，我们基本上就了解 TaiWindCss 的实现基本原理了。其实就是一个对数据流的一系列操作过程，得到最终我们想要的 CSS 模块，然后再剔除掉多余的代码，转换成我们想要的 CSS 文件。

## 特点

### 按需配置打包

Tailwind 的 [purge](https://purgecss.com/) 选项来进行 tree-shake 来减少你最终构建项目的大小；
PurgeCSS 会查找 HTML 中的 classes。它不会尝试解析你的 HTML，寻找类属性或者动态执行你的 JavaScript，它只是在整个文件中寻找任何与这个正则表达式匹配的字符串；

```js
/[^<>"'`\s]\*[^<>"'`\s:]/g`
```

> 不要使用 `btn-{type}` 这样的样式来定义样式，避免出现样式丢失情况
> 扫描文件也可以配置

```js
// tailwind.config.js
module.exports = {
  purge: ['./src/**/*.html', './src/**/*.vue', './src/**/*.jsx'],
}
```

### Just-in-Time(JIT)引擎

TailwindCSS v3，AOT 引擎 => JIT

#### JIT 的优势

1. **超快速的编译时间。** 原本 Tailwind CLI 编译需要 3-8 秒，在 JIT 模式 下仅需 0.8 秒 。
2. **直接使用任意 Variants 。** 不用再烦恼需不需要开 active 、 focus 或 disabled 等。
3. **任意值 CSS class 。** 可以直接在 HTML 里写像 top-[247px] 这样的 class，将会自动生成。 而且也可以使用`Variants： lg:top-[587px]` 。
4. **在 develop 和 production 产生一样的 CSS 。** 不需要烦恼上线后会不会有 class 灵异的消失~
5. **在开发时有更好的浏览器效能 。** 因为 develop 和 production 的 CSS 大小一样小，本地预览时不会出现 10-20 MB 的 CSS，开启相关开发工具也不会载入很久。

#### JIT 模式的限制

1. Tailwind CSS 是静态提取 class 的，写 class 务必要写完整，不然 Tailwind CSS 会无法正确的打包 CSS
   ❌ 这样是不行
   ```html
   <div :class="`mt-[${size === 'lg' ? '22px' : '17px' }]`"></div>
   ```
   ✔ 动态选择完整的 class
   ```html
   <div :class="size === 'lg' ? 'mt-[22px]' : 'mt-[17px]'"></div>
   ```
2. JIT 模式是没有使用 PurgeCSS，所以 PurgeCSS 的设定都不能用，如果出于特殊状况需要用 safelist 的话，可以增加一个 safelist.txt 达成这个目的

## 源码

### build

 <details>
    <summary>scripts/build.js: <br/>读取项目中的css文件，经过postcss插件tailwindcss进行转换的css文件。然后到处Css文件</summary>
    ```js
    import tailwind from '..'
    function buildDistFile(filename, config = {}, outFilename = filename) {
      return new Promise((resolve, reject) => {
        fs.readFile(`./${filename}.css`, (err, css) => {
          if (err) throw err
          return postcss([tailwind(config), require('autoprefixer')])
            .process(css, {
              from: `./${filename}.css`,
              to: `./dist/${outFilename}.css`,
            })
            .then((result) => {
              fs.writeFileSync(`./dist/${outFilename}.css`, result.css)
              return result
            })
            .then((result) => {
              const minified = new CleanCSS().minify(result.css)
              fs.writeFileSync(`./dist/${outFilename}.min.css`, minified.styles)
            })
            .then(resolve)
            .catch((error) => {
              console.log(error)
              reject()
            })
        })
      })
    }
    ```
 </details>

### 读取相关配置文件

  <details>
    <summary>src/index.js: <br/>定义tailwindcss命名的postCss插件，去解析css文件。</summary>
    ```js
    const plugin = postcss.plugin('tailwindcss', (config) => {
      const plugins = []
      const resolvedConfigPath = resolveConfigPath(config)
      if (!_.isUndefined(resolvedConfigPath)) {
        plugins.push(registerConfigAsDependency(resolvedConfigPath))
      }
      console.log('plugins:', plugins)
      return postcss([
        ...plugins,
        processTailwindFeatures(getConfigFunction(resolvedConfigPath || config)),
        formatCSS,
      ])
    })
    ```
 </details>

就是项目初始化的一系列配置文件。其中核心的读取配置文件就是 tailwind.config.js , 而这个就是我们再使用 tailwindcss 的时候，需要去对我们的引用进行配置化管理的文件。

### 主要入口处理逻辑

```js
return postcss([
  substituteTailwindAtRules(config, getProcessedPlugins()),
  evaluateTailwindFunctions(config),
  substituteVariantsAtRules(config, getProcessedPlugins()),
  substituteResponsiveAtRules(config),
  convertLayerAtRulesToControlComments(config),
  substituteScreenAtRules(config),
  substituteClassApplyAtRules(config, getProcessedPlugins, configChanged),
  applyImportantConfiguration(config),
  purgeUnusedStyles(config, configChanged),
]).process(css, { from: _.get(css, 'source.input.file') })
```

1. substituteTailwindAtRules 转换 AST 数据操作
2. evaluateTailwindFunctions 主题配置操作
3. substituteVariantsAtRules 变量递归规则操作
4. substituteResponsiveAtRules 常规 Responsive 规则逻辑操作
5. convertLayerAtRulesToControlComments 内容编辑描述操作
6. substituteScreenAtRules 样式 Screen 规则操作
7. substituteClassApplyAtRules 标识 @apply 逻辑处理
8. applyImportantConfiguration 传参 important 是否添加逻辑处理
9. purgeUnusedStyles 删除多余的代码，添加 purgecss 插件，读取配置删除多余的未引用的 css 样式代码
10. 最好导出我们项目开发所需的 Css 文件

### 核心代码

src 文件下面的 processTailwindFeatures.js，中有这样一行代码：

```js
processedPlugins = processPlugins([...corePlugins(config), ..._.get(config, 'plugins', [])], config)

getProcessedPlugins = function () {
  return {
    // ...jumpUrl,
    base: cloneNodes(processedPlugins.base),
    components: cloneNodes(processedPlugins.components),
    utilities: cloneNodes(processedPlugins.utilities),
  }
}
```

其中核心的功能就是遍历 src/plugins 下面的 一些列配置文件：

  <details>
    <summary>src/plugins: <br/>列配置文件。</summary>
    ```js
    'preflight',
    'container',
    'space',
    'divideWidth',
    'divideColor',
    'divideStyle',
    'divideOpacity',
    'accessibility',
    'appearance',
    'backgroundAttachment',
    'backgroundClip',
    'backgroundColor',
    'backgroundImage',
    'gradientColorStops',
    'backgroundOpacity',
    'backgroundPosition',
    'backgroundRepeat',
    'backgroundSize',
    'borderCollapse',
    'borderColor',
    'borderOpacity',
    'borderRadius',
    'borderStyle',
    'borderWidth',
    'boxSizing',
    'cursor',
    'display',
    'flexDirection',
    'flexWrap',
    'placeItems',
    'placeContent',
    'placeSelf',
    'alignItems',
    'alignContent',
    'alignSelf',
    'justifyItems',
    'justifyContent',
    ...
    ```
 </details>

遍历这些配置生成代码就是 util -> processPlugins.js 里面的代码：

<details>
    <summary>util -> processPlugins.js <br/>遍历配置生成代码。</summary>
    ```js
    handler({
        postcss,
        config: getConfigValue,
        theme: (path, defaultValue) => {
          const [pathRoot, ...subPaths] = _.toPath(path)
          const value = getConfigValue(['theme', pathRoot, ...subPaths], defaultValue)

          return transformThemeValue(pathRoot)(value)
        },
        corePlugins: (path) => {
          if (Array.isArray(config.corePlugins)) {
            return config.corePlugins.includes(path)
          }

          return getConfigValue(`corePlugins.${path}`, true)
        },
        variants: (path, defaultValue) => {
          if (Array.isArray(config.variants)) {
            return config.variants
          }

          return getConfigValue(`variants.${path}`, defaultValue)
        },
        e: escapeClassName,
        prefix: applyConfiguredPrefix,
        addUtilities: (utilities, options) => {
          const defaultOptions = { variants: [], respectPrefix: true, respectImportant: true }

          options = Array.isArray(options)
            ? Object.assign({}, defaultOptions, { variants: options })
            : _.defaults(options, defaultOptions)

          const styles = postcss.root({ nodes: parseStyles(utilities) })

          styles.walkRules((rule) => {
            if (options.respectPrefix && !isKeyframeRule(rule)) {
              rule.selector = applyConfiguredPrefix(rule.selector)
            }

            if (options.respectImportant && config.important) {
              rule.__tailwind = {
                ...rule.__tailwind,
                important: config.important,
              }
            }
          })

          pluginUtilities.push(
            wrapWithLayer(wrapWithVariants(styles.nodes, options.variants), 'utilities')
          )
        },
        addComponents: (components, options) => {
          const defaultOptions = { variants: [], respectPrefix: true }

          options = Array.isArray(options)
            ? Object.assign({}, defaultOptions, { variants: options })
            : _.defaults(options, defaultOptions)

          const styles = postcss.root({ nodes: parseStyles(components) })

          styles.walkRules((rule) => {
            if (options.respectPrefix && !isKeyframeRule(rule)) {
              rule.selector = applyConfiguredPrefix(rule.selector)
            }
          })

          pluginComponents.push(
            wrapWithLayer(wrapWithVariants(styles.nodes, options.variants), 'components')
          )
        },
        addBase: (baseStyles) => {
          pluginBaseStyles.push(wrapWithLayer(parseStyles(baseStyles), 'base'))
        },
        addVariant: (name, generator, options = {}) => {
          pluginVariantGenerators[name] = generateVariantFunction(generator, options)
        },
      })
    })
    ```

 </details>

循环一些列根据配置所需要的元素，进行遍历逻辑操作，从而生成生成 base，components ，utilities 文件。为数据逻辑操作生成原始数据。

### base 核心代码

base 的核心操作代码如下：

```js
export default function () {
  return function ({ addBase }) {
    const normalizeStyles = postcss.parse(
      fs.readFileSync(require.resolve('modern-normalize'), 'utf8')
    )
    const preflightStyles = postcss.parse(fs.readFileSync(`${__dirname}/css/preflight.css`, 'utf8'))
    addBase([...normalizeStyles.nodes, ...preflightStyles.nodes])
  }
}
```

base 就是一些基础样式配置，这里面引用了 modern-normalize 这个基础样式库来作为 TaiWindCss 的基础样式库，我们也可以自定义引用，比如代码中的 preflightStyles.css 文件，如果后续需要扩展 TaiWindCss 的 base 基础库，写法类似上传代码中 preflight.css 代码引用即可。

### utilities 核心代码

1. 我们已经明确 css 是如何的，比如我们明确字体样式向左，向右，居中等，那么代码如下：

```js
export default function () {
  return function ({ addUtilities, variants }) {
    addUtilities(
      {
        '.text-left': { 'text-align': 'left' },
        '.text-center': { 'text-align': 'center' },
        '.text-right': { 'text-align': 'right' },
        '.text-justify': { 'text-align': 'justify' },
      },
      variants('textAlign')
    )
  }
}
```

2. 我们需要根据配置文件去生成的样式文件，比如 z-index 后面的值是配置化的，那么代码如下：

```js
import createUtilityPlugin from '../util/createUtilityPlugin'

export default function () {
  return createUtilityPlugin('zIndex', [['z', ['zIndex']]])
}
```

### components 核心代码

components 这个模板，我的理解，就是提供一系列类似组件化的代码逻辑，TaiWindCss 目前它只对 布局样式 container 做了这样的操作。主要代码如下：

```js
const atRules = _(minWidths)
  .sortBy((minWidth) => parseInt(minWidth))
  .sortedUniq()
  .map((minWidth) => {
    return {
      [`@media (min-width: ${minWidth})`]: {
        '.container': {
          'max-width': minWidth,
          ...generatePaddingFor(minWidth),
        },
      },
    }
  })
  .value()

addComponents(
  [
    {
      '.container': Object.assign(
        { width: '100%' },
        theme('container.center', false) ? { marginRight: 'auto', marginLeft: 'auto' } : {},
        generatePaddingFor(0)
      ),
    },
    ...atRules,
  ],
  variants('container')
)
```

从代码逻辑上看，读取配置 screens 的值，遍历生成不同 screens 下面的 container 的样式数据。然后进行归类并输出 components 这个样式库。当然我们也可以对这块进行扩展，比如：

```js
addComponents({
  '.btn-blue': {
    backgroundColor: 'blue',
    color: 'white',
    padding: '.5rem 1rem',
    borderRadius: '.25rem',
  },
  '.btn-blue:hover': {
    backgroundColor: 'darkblue',
  },
})
//或者
addComponents(
  {
    '.btn-blue': {
      backgroundColor: 'blue',
    },
  },
  ['responsive', 'hover']
)
```

如果新增这样的插件配置，那么这些板块就是打包到 components 这个库里面。

这三个模板的配置化生产 CSS 文件，就是 TaiWindCss 的主要功能

### 插件开发

插件的功能, 给我们开发了一个入口函数，让我们可以进行配置化开发，插件的方法如下：

```js
module.exports = {
  plugins: [
    plugin(function({ addUtilities, addComponents, e, prefix, config }) {
      // Add your custom styles here
    }),
  ]
```

传递的一系列参数，就是 util -> processPlugins.js 里面的一些核心代码应用。
主要的核心代码：
入口文件 src -> index.js 读取插件配置：

```js
processTailwindFeatures(getConfigFunction(resolvedConfigPath || config))
```

getConfigFunction 方法，读取 tailwind.config.js 配置里面的插件，进行数据初始化操作，然后把这些插件写入进来，从原理上 js 下写的方法就是类似 plugins 文件夹下的哪些插件 js 文件。只是调用的方式不同而已。

具体的插件使用文档查看官网 [TaiWindCss 插件使用文档](https://www.tailwindcss.cn/docs/plugins#adding-components)
