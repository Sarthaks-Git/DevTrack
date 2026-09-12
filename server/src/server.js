const express=require('express')

const app=express();
const port=5000;

app.get('/',(req,res)=>{
    res.send("Hello Client!!!");
});

app.listen(port,()=>{
    console.log("Server Started at Port 5000!!")
});