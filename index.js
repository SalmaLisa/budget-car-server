const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors())
app.use(express.json())

//root API
app.get('/', (req, res) => {
  res.send("budget cars server is ready to use")
})




app.listen(port, () => {
  console.log('server is running at port',port)
})