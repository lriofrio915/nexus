export default function BackgroundFX() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
      <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[100px]" />
      {/* Grain overlay — served locally, no external dependency */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
    </div>
  )
}
