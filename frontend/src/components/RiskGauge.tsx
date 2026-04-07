
interface Props {
  risk: number; // value between 0 and 1
  level: "LOW" | "MEDIUM" | "HIGH";
}

function RiskGauge({ risk, level }: Props) {

  const percentage = risk * 100;

  let color = "bg-green-500";

  if (level === "MEDIUM") {
    color = "bg-yellow-500";
  }

  if (level === "HIGH") {
    color = "bg-red-500";
  }

  return (

    <div className="space-y-4">

      <div className="text-center">

        <h3 className="text-lg font-semibold">
          Parkinson Risk Meter
        </h3>

        <p className="text-gray-500">
          Multimodal Risk Assessment
        </p>

      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">

        <div
          className={`${color} h-6 transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />

      </div>

      {/* Labels */}
      <div className="flex justify-between text-sm text-gray-500">

        <span>LOW</span>
        <span>MEDIUM</span>
        <span>HIGH</span>

      </div>

      {/* Percentage Display */}
      <div className="text-center">

        <span className="text-xl font-bold">
          {percentage.toFixed(2)}%
        </span>

        <span className="ml-2 text-gray-600">
          ({level})
        </span>

      </div>

    </div>

  );
}

export default RiskGauge;