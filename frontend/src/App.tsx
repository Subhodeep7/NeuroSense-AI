import { useState, useEffect } from "react";
import { createPatient } from "./api/predictionApi";
import DashboardPage from "./pages/DashboardPage";
import PredictionPage from "./pages/PredictionPage";
import HistoryPage from "./pages/HistoryPage";
import PatientsPage from "./pages/PatientsPage";

function App() {
  const [page, setPage] = useState<"dashboard" | "predict" | "history" | "patients">("dashboard");
  const [isSplashing, setIsSplashing] = useState(true);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setIsSplashing(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const pages = {
    dashboard: <DashboardPage />,
    predict: <PredictionPage />,
    history: <HistoryPage />,
    patients: <PatientsPage searchQuery={searchQuery} />,
  };

  const navItems = [
    { id: "dashboard", label: "Overview", icon: "dashboard_customize" },
    { id: "predict", label: "Start Screening", icon: "biotech" },
    { id: "history", label: "Screening History", icon: "history" },
    { id: "patients", label: "Patient Registry", icon: "patient_list" }
  ];

  if (isSplashing) {
    return (
      <div className="fixed inset-0 bg-midnight z-[100] flex flex-col items-center justify-center overflow-hidden">
        {/* Animated Particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i} 
              className="splash-particle"
              style={{
                width: `${Math.random() * 200 + 100}px`,
                height: `${Math.random() * 200 + 100}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                opacity: 0.1
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
           <div className="w-80 h-80 rounded-[5rem] bg-medical-teal flex items-center justify-center shadow-[0_0_100px_rgba(20,184,166,0.5)] mb-12 animate-float relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50"></div>
              <span className="material-symbols-outlined text-white relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.2)]" style={{ fontSize: '260px', fontVariationSettings: "'wght' 200, 'opsz' 48" }}>neurology</span>
           </div>
           <h1 className="font-serif text-6xl font-bold text-white tracking-tight mb-3">NeuroSense AI</h1>
           <p className="text-slate uppercase tracking-[0.5em] text-xs font-bold animate-pulse opacity-80">Initializing Neural Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-pearl font-sans selection:bg-medical-teal/20 animate-in fade-in duration-700">
      
      {/* 🏛️ Clinical Sidebar (Midnight Navy) */}
      <aside className="w-72 bg-midnight text-white flex flex-col border-r border-midnight/10 fixed h-full z-50">
        <div className="p-8 pb-12">
          {/* Custom Modular Logo */}
          <div className="flex items-center gap-4 mb-12 group cursor-pointer">
            <div className="relative">
               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-medical-teal to-teal-600 flex items-center justify-center shadow-lg shadow-medical-teal/20 group-hover:scale-110 transition-transform duration-500">
                  <span className="material-symbols-outlined text-white text-2xl font-light">neurology</span>
               </div>
               <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-midnight border-2 border-midnight flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-medical-teal animate-pulse"></div>
               </div>
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold tracking-tight leading-none group-hover:text-medical-teal transition-colors">NeuroSense</h1>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate/50 font-bold mt-2 space-y-1">
                 <p>Screening</p>
                 <p>Platform</p>
                 <p className="text-medical-teal/60">For Parkinsons</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id as any)}
                className={`w-full nav-anchor ${
                  page === item.id 
                    ? "nav-anchor-active" 
                    : "text-white/40 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                <span className={`material-symbols-outlined text-[22px] font-light ${page === item.id ? "text-medical-teal" : ""}`}>{item.icon}</span>
                <span className="text-sm font-bold tracking-wide">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-white/5">


        </div>
      </aside>

      {/* 🚀 Main Workspace */}
      <main className="flex-1 ml-72 min-h-screen flex flex-col">
        <header className="h-20 px-10 flex items-center justify-between border-b border-slate/10 bg-white/40 backdrop-blur-md sticky top-0 z-40">
           <div className="flex items-center gap-3">
              <span className="text-slate text-xs font-bold uppercase tracking-widest opacity-60">Workspace</span>
              <span className="material-symbols-outlined text-slate/30 text-sm">chevron_right</span>
              <span className="text-midnight text-sm font-bold capitalize">{page.replace('_', ' ')}</span>
           </div>
           
           <div className="flex items-center gap-8">

              
              <div className="flex items-center gap-2 border-l border-slate/10 pl-8">
                 {page === 'patients' && (
                   <div className="flex items-center bg-slate/5 rounded-xl px-4 border border-slate/10 focus-within:border-medical-teal focus-within:bg-white transition-all w-64 shadow-inner">
                     <span className="material-symbols-outlined font-light text-xl text-slate">search</span>
                     <input 
                       type="text" 
                       placeholder="Search Patients..."
                       className="bg-transparent border-none text-[11px] font-bold p-2 focus:outline-none w-full text-midnight placeholder:text-slate/30"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                     />
                   </div>
                 )}
              </div>

              <button 
                onClick={() => setIsPatientModalOpen(true)}
                className="btn-premium"
              >
                 CREATE PROFILE
              </button>
           </div>
        </header>

        {/* 🏥 New Patient Modal */}
        {isPatientModalOpen && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-midnight/60 backdrop-blur-md" onClick={() => setIsPatientModalOpen(false)}></div>
              <div className="relative w-full max-w-xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                 <div className="p-10 border-b border-slate/5 bg-slate/[0.02]">
                    <div className="flex justify-between items-start mb-8">
                       <div>
                          <h2 className="font-serif text-3xl font-bold text-midnight mb-1">CREATE PROFILE</h2>
                          <p className="text-slate text-sm font-medium">Enroll patient for clinical screening</p>
                       </div>
                       <button onClick={() => setIsPatientModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate/5 text-slate transition-colors">
                          <span className="material-symbols-outlined">close</span>
                       </button>
                    </div>

                    <form className="space-y-6" onSubmit={async (e) => {
                       e.preventDefault();
                       const formData = new FormData(e.currentTarget);
                       const data = {
                          name: formData.get("name") as string,
                          age: parseInt(formData.get("age") as string),
                          gender: formData.get("gender") as string
                       };
                       try {
                          await createPatient(data);
                          setIsPatientModalOpen(false);
                          setPage("predict");
                       } catch (err) {
                          alert("Failed to enroll patient. Please check clinical server connection.");
                       }
                    }}>
                       <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2">
                             <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-2 px-1">Full Name</label>
                             <input name="name" required placeholder="Enter Name" className="input-premium" />
                          </div>
                          <div>
                             <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-2 px-1">Age</label>
                             <input name="age" type="number" required placeholder="Enter Age" className="input-premium" />
                          </div>
                          <div>
                             <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-2 px-1">Gender</label>
                             <select name="gender" className="input-premium">
                                <option>Male</option>
                                <option>Female</option>
                                <option>Other</option>
                             </select>
                          </div>
                          <div className="col-span-2">
                             <label className="text-[10px] font-bold text-slate uppercase tracking-widest block mb-2 px-1">Location / Clinical Site</label>
                             <input name="location" placeholder="Enter Clinical Site" className="input-premium" />
                          </div>
                       </div>
                       
                       <div className="pt-6 flex gap-4">
                          <button type="button" onClick={() => setIsPatientModalOpen(false)} className="flex-1 py-4 rounded-xl border border-slate/20 font-bold text-slate hover:bg-slate/5 transition-all">Cancel</button>
                          <button type="submit" className="flex-1 py-4 rounded-xl bg-midnight text-white font-bold hover:bg-midnight/90 transition-all shadow-lg shadow-midnight/20">CREATE PROFILE</button>
                       </div>
                    </form>
                 </div>
              </div>
           </div>
        )}

        <div className="p-10 max-w-[1600px] w-full mx-auto flex-1">
          {pages[page]}
        </div>

        {/* ⚖️ Medical Disclaimer Footer */}
        <footer className="px-10 py-6 border-t border-slate/5 bg-slate/[0.02]">
           <div className="flex justify-between items-center">
              <p className="text-[10px] text-slate/50 font-medium uppercase tracking-[0.1em]">
                 &copy; 2026 NeuroSense AI. All rights reserved.
              </p>
              <div className="flex items-center gap-3 text-slate/40">
                 <span className="material-symbols-outlined text-sm">info</span>
                 <p className="text-[10px] font-bold uppercase tracking-widest">
                    Note: This tool is for screening support only and is not intended for definitive clinical assessment.
                 </p>
              </div>
           </div>
        </footer>
      </main>

    </div>
  );
}

export default App;