/*
 * @Description: 头部注释: ...
 * @Version: 1.0.0
 * @Autor: michael_jier
 * @Date: 2022-03-15 23:46:26
 * @LastEditors: michael_jier
 * @LastEditTime: 2022-04-07 10:19:02
 */
import Link from './Link'
import siteMetadata from '@/data/siteMetadata'
import SocialIcon from '@/components/social-icons'

export default function Footer() {
  return (
    <footer>
      <div className="mt-16 flex flex-col items-center">
        <div className="mb-3 flex space-x-4">
          <SocialIcon kind="mail" href={`mailto:${siteMetadata.email}`} size={6} />
          <SocialIcon kind="github" href={siteMetadata.github} size={6} />
          <SocialIcon kind="juejin" href={siteMetadata.juejin} size={6} />
          <SocialIcon kind="zhihu" href={siteMetadata.zhihu} size={6} />
          <SocialIcon kind="linkedin" href={siteMetadata.linkedin} size={6} />
          <SocialIcon kind="twitter" href={siteMetadata.twitter} size={6} />
        </div>
        <div className="mb-2 flex space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <div>{siteMetadata.author}</div>
          <div>{` • `}</div>
          <div>{`© ${new Date().getFullYear()}`}</div>
          <div>{` • `}</div>
          <Link href="/">{siteMetadata.title}</Link>
        </div>
        <a
          className="mb-8 text-sm text-gray-500 dark:text-gray-400"
          href="http://beian.miit.gov.cn/?spm=a2c4g.11186623.7y9jhqsfz.109.69227dc6nWU5lo"
          target="_blank"
          data-spm-anchor-id="a2c4g.11186623.7y9jhqsfz.109"
          rel="noreferrer"
        >
          浙ICP备19051061号-2
        </a>
      </div>
    </footer>
  )
}
