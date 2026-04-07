import { useEffect, useState } from "react";
import axios from "axios";

const BASE_URL = "http://localhost:8080/api";

interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
}

function PatientsPage() {

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

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e1e2eb] relative overflow-hidden">

      {/* 🌌 Background Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#afc6ff]/10 blur-[140px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[#d8b9ff]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto p-8 space-y-10">

        {/* 🧠 HEADER */}
        <div>
          <h1 className="text-5xl font-extrabold">
            Patients <span className="text-[#afc6ff]">Management</span>
          </h1>
          <p className="text-[#8c90a0]">
            Manage neural participant records
          </p>
        </div>

        <div className="grid grid-cols-12 gap-8">

          {/* ➕ ADD PATIENT */}
          <div className="col-span-12 lg:col-span-4">

            <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] p-6 rounded-2xl shadow-[0_0_20px_rgba(175,198,255,0.1)]">

              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-[#afc6ff]">
                <span className="material-symbols-outlined">person_add</span>
                Add Patient
              </h3>

              <div className="space-y-4">

                <input
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#10131a] border border-[#2a2f3a] px-4 py-3 rounded-lg focus:ring-2 focus:ring-[#afc6ff]"
                />

                <div className="grid grid-cols-2 gap-4">

                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="bg-[#10131a] border border-[#2a2f3a] px-4 py-3 rounded-lg"
                  />

                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="bg-[#10131a] border border-[#2a2f3a] px-4 py-3 rounded-lg"
                  >
                    <option>Male</option>
                    <option>Female</option>
                  </select>

                </div>

                <button
                  onClick={addPatient}
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-gradient-to-r from-[#afc6ff] to-[#528dff] font-bold hover:scale-105 transition shadow-[0_0_20px_rgba(175,198,255,0.4)] text-gray-900"
                >
                  {loading ? "Adding..." : "Add Patient"}
                </button>

              </div>

            </div>

          </div>

          {/* 📊 PATIENT TABLE */}
          <div className="col-span-12 lg:col-span-8">

            <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] rounded-2xl overflow-hidden">

              <div className="p-6 flex justify-between items-center">
                <h3 className="text-xl font-bold">
                  Patient Directory
                </h3>

                <span className="text-sm text-[#8c90a0]">
                  {patients.length} records
                </span>
              </div>

              {patients.length === 0 ? (
                <p className="p-6 text-[#8c90a0]">
                  No patients yet
                </p>
              ) : (
                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead>
                      <tr className="text-left text-[#8c90a0] text-xs uppercase border-b border-[#2a2f3a]">
                        <th className="px-6 py-3">ID</th>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Age</th>
                        <th className="px-6 py-3">Gender</th>
                      </tr>
                    </thead>

                    <tbody>
                      {patients.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-[#2a2f3a] hover:bg-[#272a31]/50 transition"
                        >
                          <td className="px-6 py-4 text-[#afc6ff] font-mono">
                            #{p.id}
                          </td>

                          <td className="px-6 py-4 font-semibold">
                            {p.name}
                          </td>

                          <td className="px-6 py-4">
                            {p.age}
                          </td>

                          <td className="px-6 py-4">
                            {p.gender}
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
    </div>
  );
}

export default PatientsPage;