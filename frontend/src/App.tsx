import { useState } from "react";

// Mocking the page components based on your original code. 
// You can keep your existing imports as they were.
import DashboardPage from "./pages/DashboardPage";
import PredictionPage from "./pages/PredictionPage";
import HistoryPage from "./pages/HistoryPage";
import PatientsPage from "./pages/PatientsPage";

function App() {
  const [page, setPage] = useState<"dashboard" | "predict" | "history" | "patients">("dashboard");

  const pages = {
    dashboard: <DashboardPage />,
    predict: <PredictionPage />,
    history: <HistoryPage />,
    patients: <PatientsPage />,
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#e1e2eb] font-['Manrope'] overflow-x-hidden">
      
      {/* Premium Glassmorphic Header */}
      <header className="fixed top-0 w-full z-50 bg-[#10131a]/60 backdrop-blur-xl border-b border-[#272a31]/50 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D7DFF] to-[#afc6ff] flex items-center justify-center shadow-[0_0_20px_rgba(45,125,255,0.4)]">
              <span className="material-icons text-white text-xl">psychology</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tighter bg-gradient-to-r from-[#afc6ff] to-[#528dff] bg-clip-text text-transparent">
              NeuroSense-AI
            </h1>
          </div>

          <nav className="flex items-center gap-2 bg-[#191c22]/50 p-1.5 rounded-2xl border border-[#272a31]/30">
            {[
              { id: "dashboard", label: "Dashboard", icon: "dashboard" },
              { id: "predict", label: "Prediction", icon: "biotech" },
              { id: "history", label: "History", icon: "history" },
              { id: "patients", label: "Patients", icon: "groups" }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ease-out active:scale-95 ${
                  page === item.id
                    ? "bg-gradient-to-r from-[#2D7DFF] to-[#528dff] text-white shadow-[0_0_25px_rgba(45,125,255,0.4)]"
                    : "text-[#e1e2eb]/50 hover:text-[#e1e2eb] hover:bg-[#272a31]/50"
                }`}
              >
                <span className="material-icons text-[18px]">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
             <button className="p-2.5 rounded-xl text-[#e1e2eb]/60 hover:text-[#afc6ff] hover:bg-[#272a31]/50 transition-colors">
                <span className="material-icons">notifications</span>
             </button>
             <button className="p-2.5 rounded-xl text-[#e1e2eb]/60 hover:text-[#afc6ff] hover:bg-[#272a31]/50 transition-colors">
                <span className="material-icons">settings</span>
             </button>
             <div className="w-10 h-10 rounded-xl bg-[#272a31] border border-[#363940] flex items-center justify-center cursor-pointer hover:border-[#afc6ff] transition-colors">
                <span className="material-icons text-[#afc6ff]">account_circle</span>
             </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-28 pb-12 px-8 max-w-7xl mx-auto min-h-screen relative">
        {/* Subtle Background Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#2D7DFF]/10 blur-[120px] rounded-full -z-10"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#528dff]/5 blur-[120px] rounded-full -z-10"></div>
        
        {/* Page Container with Transition placeholder */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {pages[page]}
        </div>
      </main>

    </div>
  );
}

export default App;