const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
var jwt = require('jsonwebtoken');

//middleware
app.use(cors())
app.use(express.json())

const verifyJWT=(req, res, next) => {
  const header = req.headers.authorization
  if (!header) {
    return res.status(401).send({message:"Unauthorized Access"})
  }
  const token = header.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({message:"forbidden Access"})
    }
    req.decoded = decoded;
    next()
  })
}

//root api
app.get('/', (req, res) => {
  res.send("budget cars server is ready to use")
})

//mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.t3mwvsa.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    const allAccountsCollection = client.db('budgetCarsDB').collection('allAccounts')
    const carsModelCollection = client.db('budgetCarsDB').collection('carsModel')

    app.post('/allAccounts', async (req, res) => {
      const newlyCreatedAccount = req.body 
      const result = await allAccountsCollection.insertOne(newlyCreatedAccount)
      res.send(result)
    })

    //jwt
    app.get('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
      res.send({token})
    })

    //admin check
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email 
      const emailQuery = { userEmail: email }
      const user = await allAccountsCollection.findOne(emailQuery)
      if (user.accountStatus === "admin") {
        res.send({isAdmin:true})
      }
    })

    //seller check
    app.get('/seller/:email', async (req, res) => {
      const email = req.params.email 
      const emailQuery = { userEmail: email }
      const user = await allAccountsCollection.findOne(emailQuery)
      console.log(emailQuery)
      if (user?.accountStatus === "seller") {
       return res.send({isSeller:true})
      }
    })
    //products api

    //sellers api
    app.post('/sellers', verifyJWT, async (req, res) => {
      const email = req.body.email
      const emailQuery = {userEmail: email }
      const userData = await allAccountsCollection.findOne(emailQuery)
      if (userData?.accountStatus !== "admin") {
        // return res.status(403).send({message:"forbidden Access"})
      }
      console.log(userData)
      const query = {}
      const allAccounts = await allAccountsCollection.find(query).toArray()
      const sellers = allAccounts.filter(d=>d.accountStatus==="seller") 
      res.send(sellers)
    })
    app.put('/sellers/verifyStatus/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }
      const options = { upsert: true };
      const updateDoc = {
        $set: req.body
      };
      const result = await allAccountsCollection.updateOne(query,updateDoc,options)
      res.send(result)
      
    })
    app.delete('/sellers/:id',verifyJWT, async (req, res) => {
      const id = req.params.id 
      
      const query = { _id: ObjectId(id) }
      const result = await allAccountsCollection.deleteOne(query)
      res.send(result)
      
    })

    //buyers api
    app.get('/buyers', async (req, res) => {
      const query = {}
      const data = await allAccountsCollection.find(query).toArray()
      const buyers = data.filter(d=>d.accountStatus === "buyer") 
      res.send(buyers)
    })
    app.delete('/buyers/:id',verifyJWT, async (req, res) => {
      const id = req.params.id 
      const query = { _id: ObjectId(id) }
      const result = await allAccountsCollection.deleteOne(query)
      res.send(result)
      
    })
  }
  finally {
    
  }
}
run().catch(err=>console.log(err))

client.connect(err => {
 console.log(err)
});



app.listen(port, () => {
  console.log('server is running at port',port)
})