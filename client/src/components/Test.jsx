import React, { useState } from 'react'

const Test = () => {

    const [message,setMessage]=useState("");

    async function fetchData() {
        const response=await fetch("http://localhost:5000/api/health");
        const data=await response.text();
        setMessage(data);
    }

  return (
    <>
        <button onClick={fetchData}>Request Server</button>
        <h1>{message}</h1>
    </>
  )
}

export default Test