import Terminal from '../../components/terminal';
export default function TradePage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <h1> Risk first. Position second. </h1>
          <p> Live prices, profit deductions and an intent preview. </p>
        </div>
        <span className="tag"> Live submission disabled </span>
      </section>
      <Terminal />
    </>
  );
}
