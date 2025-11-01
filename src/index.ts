import path from 'path'
import express, { Request, Response } from 'express'

const app = express()
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.get('/', (req: Request, res: Response) => {
  res.render('index', {
    title: 'Home Page',
    message: 'Welcome to the Home Page!',
  })
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
