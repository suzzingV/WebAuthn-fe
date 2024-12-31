const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        main: './main.js',
    },
    output: {
        path: path.resolve('./dist'),
        filename: '[name].js'
    },
    devServer: {
        liveReload: true,
        port: 3000, // 원하는 포트 번호 설정
        static: './dist', // 정적 파일 경로
        hot: true, // 핫 리로딩 활성화
        open: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({ template: './index.html'}),
        new CleanWebpackPlugin(),
    ]
}