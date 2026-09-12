import {createBrowserRouter,RouterProvider} from  "react-router-dom"
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/AppLayout"
import Coding from "./pages/Coding";
import Projects from './pages/Projects'
import Goals from './pages/Goals'
import Journal from "./pages/Journal";
import Timeline from "./pages/Timeline";
const router=createBrowserRouter(
  [
    {
      path: "/",
      element: <Landing/>
    },
    {
      path: "/register",
      element: <Register/>
    },
    {
      path: "/login",
      element: <Login/>
    },
    {
      path: "/app",
      element:<AppLayout/>,
      children:[
        {path: "dashboard",
          element: <Dashboard/>
        },
        {path: "goals",
          element: <Goals/>
        },
        {path: "projects",
          element: <Projects/>
        },
        {path: "coding",
          element: <Coding/>
        },
        {path: "journal",
          element:<Journal/>
        },
        {path: "timeline",
          element: <Timeline/>
        },
      ]
    }
  ]
)


function App() {
 
  return (
    <>
     <RouterProvider router={router}></RouterProvider>
    </>
  );
}

export default App;
