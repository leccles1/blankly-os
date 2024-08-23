import app from './app';
app.init().then(function () {
    const port = parseInt(process.env.PORT || '80')
    app.server.listen(port, () => {
        console.log('listening on port:', port)
    })
})
