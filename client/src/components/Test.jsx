import React, { useState } from 'react'

const Test = () => {

    const [message,setMessage]=useState("");
    const [loading,setLoading]=useState(false);
    async function fetchData() {
        const response=await fetch("http://localhost:5000/api/health");
        const data=await response.text();
        setMessage(data);
    }

    async function serverComm(){

      const userData={
        username:"Sarthak",
        email:"sarthak@gmail.com"
      };
      
      setLoading(true);
      try{

        const response=await fetch("http://localhost:5000/api/test",{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
          },
          body:JSON.stringify(userData),
        });

        if(!response.ok){
          throw new Error(`Server error: ${response.status}`);
        }

        const result=await response.json();
        setMessage(result.message);
        console.log(result)
      }catch(error){
        console.error("Error sending data",error);
      }finally{
        setLoading(false);
      }
    };
  return (
    <>
        <button onClick={fetchData}>Request Server</button>
        <h1>{message}</h1>

        <button onClick={serverComm} disabled={loading}>
          {loading? 'Sending...': 'Send JSON to Backend'}
        </button>
    </>
  )
  
}

export default Test