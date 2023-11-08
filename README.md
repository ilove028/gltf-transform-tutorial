使用这两行命令 要用pnpm安装依赖 要不然 打包出来的js gltf-transform/function还是会引用sharp 报sharp依赖问题
rollup --config rollup.config.mjs
pkg .\dist\runCreate3dtiles.js -t node16-win --out-path .\bin
不使用
pkg .\package.json
使用上两行虽然打包会出现sharp warning但是程序能正常运行，使用 pkg .\package.json 会出现sharp模块找不到问题

pkg .\src\testSharp.js -t node16-win --out-path .\bin
[https://juejin.cn/post/7099706452738048037]

1. 安装 nasm https://blog.csdn.net/zhouyingge1104/article/details/112969379
2. 设置nasm环境变量 path
3. powershell 运行 nexe -i "dist\runCreate3dtiles.js" -o "bin\runCreate3dtiles.exe" --build 首次构建
4. 打包出来模块引用还是不对
