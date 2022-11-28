const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const header = req.headers.authorization;
  console.log(header)
  if (!header) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = header.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

//root
app.get("/", (req, res) => {
  res.send("budget cars server is ready to use");
});

//mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.t3mwvsa.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const allAccountsCollection = client
      .db("budgetCarsDB")
      .collection("allAccounts");
    const carModelsCollection = client
      .db("budgetCarsDB")
      .collection("carsModel");
    const allCarCollection = client.db("budgetCarsDB").collection("allCar");
    const bookingCollection = client.db("budgetCarsDB").collection("bookings");
    const reportedItemsCollection = client
      .db("budgetCarsDB")
      .collection("reportedItems");
    const paymentCollection = client.db("budgetCarsDB").collection("payments");

    //========================================
    //all user account
    app.post("/allAccounts", async (req, res) => {
      const newlyCreatedAccount = req.body;
      const result = await allAccountsCollection.insertOne(newlyCreatedAccount);
      res.send(result);
    });
    //========================================
    //jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "10h",
      });
      res.send({ token });
    });
    //========================================
    //payment

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //========================================
    //store payment
    app.post("/payments", async (req, res) => {
      const paymentData = req.body;
      const result = await paymentCollection.insertOne(paymentData);
      res.send(result);
    });

    //========================================
    //carModel
    app.get("/carModels", async (req, res) => {
      const query = {};
      const result = await carModelsCollection.find(query).toArray();
      res.send(result);
    });
    //========================================
    //single model api
    app.get("/carModels/:model", async (req, res) => {
      const model = req.params.model;
      const query = { model: model };
      const sameModelCars = await allCarCollection.find(query).toArray();

      let result = await Promise.all(
        sameModelCars.map(async (car) => {
          const filter = { userEmail: car.sellerEmail };
          const seller = await allAccountsCollection.findOne(filter);

          car.sellerStatus = seller.sellerStatus;
          return car;
        })
      );
      res.send(result);
    });
    //========================================
    //all car of every model
    app.post("/allCar", async (req, res) => {
      const data = req.body;
      const result = await allCarCollection.insertOne(data);
      res.send(result);
    });
    //========================================
    //my products
    app.post("/products", verifyJWT, async (req, res) => {
      const email = req.body.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden Access" });
      }

      const emailQuery = { userEmail: email };
      const userData = await allAccountsCollection.findOne(emailQuery);
      if (userData?.accountStatus !== "seller") {
        return res.status(403).send({ message: "forbidden Access" });
      }

      const query = { sellerEmail: email };
      const products = await allCarCollection.find(query).toArray();

      res.send(products);
    });
    //========================================
    //product advertise
    app.put("/products/advertise/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: "advertised",
        },
      };
      const result = await allCarCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });
    //========================================
    //advertised product load api
    app.get("/products/advertise", async (req, res) => {
      const query = {};
      const allCar = await allCarCollection.find(query).toArray();
      const advertisedProducts = allCar.filter(
        (car) => car.status === "advertised" && car.saleStatus === "available"
      );
      res.send(advertisedProducts);
    });
    //========================================
    //product delete
    app.delete("/products/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await allCarCollection.deleteOne(query);
      res.send(result);
    });
    //========================================
    //buyer verify
    app.get("/buyer/:email", async (req, res) => {
      const email = req.params.email;
      const emailQuery = { userEmail: email };
      const user = await allAccountsCollection.findOne(emailQuery);
      if (user?.accountStatus === "buyer") {
        res.send({ isBuyer: true });
      }
    });
    
    //========================================
    //admin verify
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const emailQuery = { userEmail: email };
      const user = await allAccountsCollection.findOne(emailQuery);
      if (user?.accountStatus === "admin") {
        res.send({ isAdmin: true });
      }
    });
    //========================================
    //seller verify
    app.get("/seller/:email", async (req, res) => {
      const email = req.params.email;
      const emailQuery = { userEmail: email };
      const user = await allAccountsCollection.findOne(emailQuery);

      if (user?.accountStatus === "seller") {
        res.send({ isSeller: true });
      }
    });
    //========================================
    //all seller
    app.post("/sellers", verifyJWT, async (req, res) => {
      const email = req.body.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden Access" });
      }

      const emailQuery = { userEmail: email };
      const userData = await allAccountsCollection.findOne(emailQuery);
      if (userData?.accountStatus !== "admin") {
        return res.status(403).send({ message: "forbidden Access" });
      }

      const query = {};
      const allAccounts = await allAccountsCollection.find(query).toArray();
      const sellers = allAccounts.filter((d) => d.accountStatus === "seller");
      res.send(sellers);
    });
    //========================================
    //seller status verification api
    app.put("/sellers/verifyStatus/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: req.body,
      };
      const result = await allAccountsCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });
    //========================================
    //seller delete api
    app.delete("/sellers/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      const query = { _id: ObjectId(id) };
      const result = await allAccountsCollection.deleteOne(query);
      res.send(result);
    });
    //========================================
    //all buyers
    app.post("/buyers", verifyJWT, async (req, res) => {
      const email = req.body.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden Access" });
      }
      const emailQuery = { userEmail: email };
      const userData = await allAccountsCollection.findOne(emailQuery);
      if (userData?.accountStatus !== "admin") {
        return res.status(403).send({ message: "forbidden Access" });
      }
      const query = {};
      const data = await allAccountsCollection.find(query).toArray();
      const buyers = data.filter((d) => d.accountStatus === "buyer");
      res.send(buyers);
    });
    //========================================
    //buyer delete
    app.delete("/buyers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await allAccountsCollection.deleteOne(query);
      res.send(result);
    });
    //========================================
    //booking store
    app.post("/bookings", async (req, res) => {
      const bookingInfo = req.body;
      const result = await bookingCollection.insertOne(bookingInfo);
      res.send(result);
    });
    //========================================
    //booking get api
    app.post("/bookings/:email", verifyJWT, async (req, res) => {
      const paramEmail = req.params.email
      const email = req.body.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden Access" });
      }
      const query = { email: paramEmail };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });
    //========================================
    app.get("/bookingPayment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });
    //========================================
    //update payment status
    app.patch("/bookingPayment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const paidProduct = await bookingCollection.findOne(query);
      const carIdQuery = { _id: ObjectId(paidProduct.carId) };
      const updateDoc1 = {
        $set: {
          saleStatus: "sold",
        },
      };
      const soldCar = await allCarCollection.updateOne(carIdQuery, updateDoc1);
      const updateDoc2 = {
        $set: {
          paymentStatus: "paid",
        },
      };
      const result = await bookingCollection.updateOne(query, updateDoc2);
      res.send(result);
    });
    //============================================
    // add a reported item
    app.post("/reportedItems", async (req, res) => {
      const reportedItem = req.body;
      const result = await reportedItemsCollection.insertOne(reportedItem);
      res.send(result);
    });
    //================================
    //get reported items
    app.get("/reportedItems", async (req, res) => {
      const query = {};
      const result = await reportedItemsCollection.find(query).toArray();
      res.send(result);
    });
//==============================
    //reported item delete 
    app.delete("/reportedItems/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await reportedItemsCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}
run().catch((err) => console.log(err));

client.connect((err) => {
  console.log(err);
});

app.listen(port, () => {
  console.log("server is running at port", port);
});
