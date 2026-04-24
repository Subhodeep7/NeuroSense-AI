import { useEffect, useState } from "react";
import axios from "axios";

const BASE_URL = "http://localhost:8080/api";

interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
}

function PatientsPage({ searchQuery = "" }: { searchQuery?: string }) {

  const [patients, setPatients] = useState<Patient[]>([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(60);
  const [gender, setGender] = useState("Male");
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadPatients(); }, []);

  async function loadPatients() {
    try {
      const response = await axios.get(`${BASE_URL}/patients`);
      setPatients(response.data);
    } catch (error) {
      console.error(error);
      alert("Failed to load patients");
    }
  }

  async function addPatient() {
    if (!name.trim() || age <= 0) {
      alert("Enter valid patient details");
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${BASE_URL}/patients`, { name, age, gender });
      setName("");
      setAge(60);
      setGender("Male");
      await loadPatients();
    } catch (error) {
      console.error(error);
      alert("Failed to add patient");
    }

    setLoading(false);
  }

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `#NS-${p.id.toString().padStart(4, '0')}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">

      {/* 🧠 HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-serif text-4xl font-bold text-midnight tracking-tight mb-2">
            Patient Registry
          </h1>
          <p className="text-slate font-medium">
            Secure database for neural screening participants
          </p>
        </div>
        <div className="flex gap-2">
           <div className="px-4 py-2 rounded-xl bg-medical-teal/10 border border-medical-teal/20 text-[10px] font-bold text-medical-teal uppercase tracking-widest">
              Live Synchronization Active
           </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">

        {/* ➕ REGISTER PATIENT */}
        <div className="col-span-12 lg:col-span-4">
          <div className="medical-card p-10 bg-white shadow-2xl sticky top-28 border-slate/5">
            <div className="flex items-center gap-3 mb-8">
               <div className="w-10 h-10 rounded-xl bg-medical-teal/10 flex items-center justify-center text-medical-teal shadow-sm">
                  <span className="material-symbols-outlined text-xl">person_add</span>
               </div>
               <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-midnight">Enroll Patient</h3>
                  <p className="text-[9px] text-slate font-bold uppercase tracking-widest opacity-60">New Clinical Record</p>
               </div>
            </div>

            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-bold text-slate uppercase tracking-widest mb-3 block opacity-60">Full Legal Name</label>
                <input
                  placeholder="Enter Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-premium"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-widest mb-3 block opacity-60">Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="input-premium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate uppercase tracking-widest mb-3 block opacity-60">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="input-premium appearance-none cursor-pointer"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <button
                onClick={addPatient}
                disabled={loading || !name.trim()}
                className="w-full py-4 rounded-2xl bg-midnight text-white font-bold text-sm hover:bg-midnight/90 transition-all shadow-xl shadow-midnight/20 disabled:opacity-20 active:scale-95"
              >
                {loading ? "Enrolling..." : "Complete Enrollment"}
              </button>
              
              <p className="text-[9px] text-slate/50 font-medium text-center leading-relaxed">
                 By enrolling, this subject's data will be processed according to HIPAA-compliant screening protocols.
              </p>
            </div>
          </div>
        </div>

        {/* 📊 PATIENT TABLE */}
        <div className="col-span-12 lg:col-span-8">
          <div className="medical-card bg-white shadow-2xl overflow-hidden border-slate/5">
            <div className="p-8 border-b border-slate/10 flex justify-between items-center bg-slate/[0.01]">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-slate/5 flex items-center justify-center text-slate border border-slate/10">
                    <span className="material-symbols-outlined text-xl">groups</span>
                 </div>
                 <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-midnight">Patient Directory</h3>
                    <p className="text-[10px] text-slate font-medium uppercase tracking-widest mt-1">Verified Registry Records</p>
                 </div>
              </div>
              <span className="px-4 py-2 rounded-xl bg-slate/5 border border-slate/10 text-[10px] font-bold text-slate tracking-widest uppercase">
                {patients.length} Active Profiles
              </span>
            </div>

            {patients.length === 0 ? (
              <div className="p-32 text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-slate/5 flex items-center justify-center mx-auto">
                   <span className="material-symbols-outlined text-5xl text-slate/20 font-light">person_search</span>
                </div>
                <div>
                   <p className="text-slate font-serif text-xl mb-2">Registry is Empty</p>
                   <p className="text-[10px] text-slate/40 font-bold uppercase tracking-widest">Enroll your first patient to begin screening.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-slate border-b border-slate/10 bg-slate/[0.02]">
                      <th className="px-10 py-6 font-bold">Patient Ref</th>
                      <th className="px-10 py-6 font-bold">Patient Identity</th>
                      <th className="px-10 py-6 font-bold">Demographics</th>
                      <th className="px-10 py-6 text-right font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate/10">
                    {filteredPatients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate/[0.02] transition-colors group">
                        <td className="px-10 py-8">
                          <span className="text-xs font-mono font-bold text-medical-teal bg-medical-teal/5 px-3 py-1 rounded-lg border border-medical-teal/10">#NS-{p.id.toString().padStart(4, '0')}</span>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-full bg-slate/5 flex items-center justify-center text-midnight font-serif font-bold text-xs border border-slate/10 group-hover:bg-midnight group-hover:text-white transition-all">
                                {p.name[0]}
                             </div>
                             <span className="text-sm font-bold text-midnight group-hover:translate-x-1 transition-transform">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex gap-2">
                             <span className="px-3 py-1 rounded-lg bg-slate/5 border border-slate/10 text-[10px] font-bold text-slate tracking-widest">{p.age} YRS</span>
                             <span className="px-3 py-1 rounded-lg bg-slate/5 border border-slate/10 text-[10px] font-bold text-slate uppercase tracking-widest">{p.gender}</span>
                          </div>
                        </td>
                        <td className="px-10 py-8 text-right">
                           <div className="flex items-center justify-end gap-2">
                              <span className="text-[9px] font-bold text-medical-teal uppercase tracking-widest opacity-60">Verified</span>
                              <span className="w-2 h-2 rounded-full bg-medical-teal inline-block shadow-[0_0_8px_rgba(20,184,166,0.6)]"></span>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default PatientsPage;