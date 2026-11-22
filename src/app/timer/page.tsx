"use client";

import { useState, useEffect } from "react";

export default function TimerPage() {
	const [minutes, setMinutes] = useState(30);
	const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
	const [running, setRunning] = useState(false);
	const [timeUp, setTimeUp] = useState(false);

	useEffect(() => {
		if (!running || secondsLeft === null) return;

		if (secondsLeft <= 0) {
			setRunning(false);
			setTimeUp(true);
			return;
		}

		const interval = setInterval(() => {
			setSecondsLeft((prev) => (prev !== null ? prev - 1 : null));
		}, 1000);

		return () => clearInterval(interval);
	}, [running, secondsLeft]);

	const startTimer = () => {
		if (minutes < 1 || minutes > 180) return;

		setTimeUp(false);
		setSecondsLeft(minutes * 60);
		setRunning(true);
	};

	const stopTimer = () => {
		setRunning(false);
		setSecondsLeft(null);
		setTimeUp(false);
	};

	const formatTime = (totalSeconds: number) => {
		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	};

	return (
		<main className="min-h-screen bg-gradient-to-b from-[#080d25] to-[#164b96] text-white flex items-center justify-center">
			<div className="w-full max-w-2xl p-8 text-center">
				{timeUp ? (
					<>
						<h1 className="text-6xl font-bold mb-6">TIME'S UP!</h1>
						<p className="text-2xl mb-8">
							The activity time has ended.
						</p>

						<button
							onClick={stopTimer}
							className="bg-gray-300 text-black px-10 py-4 rounded-md hover:bg-white"
						>
							Back
						</button>
					</>
				) : (
					<>
						<h1 className="text-3xl font-semibold mb-3">Set Timer</h1>

						<p className="mb-6">
							Set the total length of the activity.
							<br />
							It must be between 1 and 180 minutes.
						</p>

						{!running ? (
							<>
								<div className="flex items-center justify-center gap-4 mb-6">
									<input
										type="number"
										min="1"
										max="180"
										value={minutes}
										onChange={(e) => {
											const value = Number(e.target.value);
											if (value >= 1 && value <= 180)
												setMinutes(value);
										}}
										className="w-28 rounded-md bg-gray-200 text-black text-center p-3"
									/>
									<span>Minutes</span>
								</div>

								<div className="flex justify-center gap-4 mb-8">
									{[1, 90, 180].map((preset) => (
										<button
											key={preset}
											onClick={() => setMinutes(preset)}
											className="bg-gray-300 text-black px-8 py-4 rounded-md hover:bg-white"
										>
											{preset}
										</button>
									))}
								</div>

								<button
									onClick={startTimer}
									disabled={minutes < 1 || minutes > 180}
									className="bg-gray-300 text-black px-10 py-4 rounded-md hover:bg-white disabled:opacity-50"
								>
									START
								</button>
							</>
						) : (
							<>
								<h2 className="text-7xl font-bold my-10">
									{formatTime(secondsLeft ?? 0)}
								</h2>

								<p className="text-xl mb-6">Time remaining</p>

								<button
									onClick={stopTimer}
									className="bg-gray-300 text-black px-8 py-3 rounded-md hover:bg-white"
								>
									Stop
								</button>
							</>
						)}
					</>
				)}
			</div>
		</main>
	);
}