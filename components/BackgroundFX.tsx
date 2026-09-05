export default function BackgroundFX() {
  return (
    // overflow-hidden keeps the blurred blobs from widening the page: they are
    // deliberately positioned past the edges and would otherwise let a phone
    // scroll sideways into empty space.
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-purple-600/20 rounded-full blur-[80px] sm:blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-cyan-600/20 rounded-full blur-[80px] sm:blur-[120px] animate-pulse delay-1000" />
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[400px] h-[400px] sm:w-[800px] sm:h-[800px] bg-blue-900/10 rounded-full blur-[100px]" />
      {/* Grain overlay — served locally, no external dependency */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
    </div>
  )
}
