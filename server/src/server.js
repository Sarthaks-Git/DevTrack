const express=require('express')
const cors=require('cors')
const app=express();
const port=5000;

app.use(cors())

app.get('/',(req,res)=>{
    res.send("Hello Client!!!");
});
app.get('/api/health',(req,res)=>{
    res.send("DevTrack API is healthy:)");
});

app.listen(port,()=>{
    console.log("Server Started at Port 5000!!")
});