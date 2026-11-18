(function (root) {
  const round = x => Math.round(x * 100) / 100;
  const pv = [0,0,0,0,0,0,0,3,10,22,35,48,54,51,40,27,13,3,0,0,0,0,0,0];
  const heat = [29,28,28,30,34,40,48,49,42,35,30,26,24,23,24,27,34,42,50,53,48,41,35,31];
  const base = [15,14,14,14,15,17,20,23,24,24,24,23,22,22,23,24,26,29,32,33,30,26,21,17];
  const temp = [-3,-4,-4,-5,-5,-5,-4,-2,0,2,4,6,8,9,9,8,6,4,2,1,0,-1,-2,-3];
  const tesEff = .90, essEff = .95;
  function simulate(mode, {heatScale=1,pvScale=1,ambientOffset=0}={}) {
    let tank = 0, battery = 0;
    return heat.map((initial, h) => {
      const demand=initial*heatScale, sun=pv[h]*pvScale, air=temp[h]+ambientOffset;
      const cop = 2.8 + (air + 5) * .065;
      const wanted = mode === 'base' ? 0 : 18;
      const store = h >= 11 && h <= 14 ? Math.min(wanted, (70 - tank) / tesEff) : 0;
      const release = h >= 18 && h <= 21 ? Math.min(tank, 18, demand) : 0;
      tank += store * tesEff - release;
      const output = demand + store - release;
      const hp = output / cop;
      const aux = .7 + (store + release > 0 ? .45 : 0);
      const load = base[h] + hp + aux;
      const charge = mode === 'dr' ? Math.min(8, Math.max(0, sun - load), (24 - battery) / essEff) : 0;
      const discharge = mode === 'dr' && h >= 18 && h <= 21 ? Math.min(7, battery * essEff, Math.max(0, load - sun)) : 0;
      battery += charge * essEff - discharge / essEff;
      const net = load + charge - discharge - sun;
      const tariff = h >= 18 && h <= 21 ? 236 : h >= 10 && h <= 16 ? 118 : 156;
      return {h, pv:sun, heat:demand, temp:air, base:base[h], cop, output, hp, aux, load, store, release, tank, battery, charge, discharge, grid:Math.max(net,0), export:Math.max(-net,0), self:Math.min(sun,load)+discharge, tariff};
    });
  }
  function summary(rows) {
    const sum = fn => rows.reduce((acc, row) => acc + fn(row), 0);
    const energy = sum(r => r.hp + r.aux);
    return {energy, grid:sum(r=>r.grid), self:sum(r=>r.self), peak:Math.max(...rows.map(r=>r.grid)), cost:sum(r=>r.grid*r.tariff), cop:sum(r=>r.heat)/energy};
  }
  const model = {simulate, summary, round, tesEff, essEff};
  if (typeof module !== 'undefined') module.exports = model;
  else root.P2H = model;
})(globalThis);
