使用这两行命令
rollup --config rollup.config.mjs
pkg .\dist\runCreate3dtiles.js -t node16-win --out-path .\bin
不使用
pkg .\package.json
使用上两行虽然打包会出现sharp warning但是程序能正常运行，使用 pkg .\package.json 会出现sharp模块找不到问题

pkg .\src\testSharp.js -t node16-win --out-path .\bin
[https://juejin.cn/post/7099706452738048037]
