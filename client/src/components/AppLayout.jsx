import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import AmbientBackground from "./ui/AmbientBackground";

function AppLayout() {
    return (
        <AmbientBackground>
            <div className="relative min-h-screen">

                {/* Fixed sidebar */}
                <aside className="fixed inset-y-0 left-0 z-30 w-64">
                    <Sidebar />
                </aside>

                {/* Main application area */}
                <main className="min-h-screen pl-64">
                    <Outlet />
                </main>

            </div>
        </AmbientBackground>
    );
}

export default AppLayout;