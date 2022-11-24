const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()

//middleware
app.use(cors())
app.use(express.json())

//root API
app.get('/', (req, res) => {
  res.send("budget cars server is ready to use")
})

//mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.t3mwvsa.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log(uri)
async function run() {
  try {
    const allAccountsCollection = client.db('budgetCarsDB').collection('allAccounts')

    app.post('/allAccounts', async (req, res) => {
      const newlyCreatedAccount = req.body 
      const result = await allAccountsCollection.insertOne(newlyCreatedAccount)
      res.send(result)
    })
  }
  finally {
    
  }
}


client.connect(err => {
 console.log(err)
});



app.listen(port, () => {
  console.log('server is running at port',port)
})