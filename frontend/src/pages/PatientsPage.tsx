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

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [name, setName] =
    useState("");

  const [age, setAge] =
    useState<number>(60);

  const [gender, setGender] =
    useState("Male");


  useEffect(() => {

    loadPatients();

  }, []);


  async function loadPatients() {

    try {

      const response =
        await axios.get(`${BASE_URL}/patients`);

      setPatients(response.data);

    }
    catch (error) {

      console.error(error);

      alert("Failed to load patients");

    }

  }


  async function addPatient() {

    if (!name || !age || !gender) {

      alert("Fill all fields");

      return;

    }

    try {

      await axios.post(
        `${BASE_URL}/patients`,
        {
          name,
          age,
          gender
        }
      );

      alert("Patient added");

      setName("");
      setAge(60);
      setGender("Male");

      loadPatients();

    }
    catch (error) {

      console.error(error);

      alert("Failed to add patient");

    }

  }


  return (

    <div className="max-w-4xl mx-auto space-y-6">

      {/* Title */}
      <div>

        <h2 className="text-2xl font-bold text-gray-800">
          Patients Management
        </h2>

        <p className="text-gray-500">
          Add and manage patient records
        </p>

      </div>


      {/* Add Patient Card */}
      <div className="bg-white shadow rounded-xl p-6">

        <h3 className="text-lg font-semibold mb-4">
          Add New Patient
        </h3>

        <div className="grid md:grid-cols-3 gap-4">

          <input
            placeholder="Patient Name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />


          <input
            type="number"
            placeholder="Age"
            value={age}
            onChange={(e) =>
              setAge(Number(e.target.value))
            }
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />


          <select
            value={gender}
            onChange={(e) =>
              setGender(e.target.value)
            }
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >

            <option value="Male">
              Male
            </option>

            <option value="Female">
              Female
            </option>

          </select>

        </div>


        <button
          onClick={addPatient}
          className="mt-4 w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >

          Add Patient

        </button>

      </div>


      {/* Patients Table Card */}
      <div className="bg-white shadow rounded-xl p-6">

        <h3 className="text-lg font-semibold mb-4">
          Patient List
        </h3>

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead>

              <tr className="border-b text-left text-gray-600">

                <th className="py-2">
                  ID
                </th>

                <th className="py-2">
                  Name
                </th>

                <th className="py-2">
                  Age
                </th>

                <th className="py-2">
                  Gender
                </th>

              </tr>

            </thead>


            <tbody>

              {patients.map((p) => (

                <tr
                  key={p.id}
                  className="border-b hover:bg-gray-50"
                >

                  <td className="py-2">
                    {p.id}
                  </td>

                  <td className="py-2 font-medium">
                    {p.name}
                  </td>

                  <td className="py-2">
                    {p.age}
                  </td>

                  <td className="py-2">
                    {p.gender}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>


    </div>

  );

}

export default PatientsPage;