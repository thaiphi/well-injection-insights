# SWD-10 opt-in single-phase brine traverse

The connected disposal case now supports an optional steady, gas-free NaCl brine wellbore traverse. Omitting `hydraulics` preserves the existing uniform property calculations, output method identity and serialized shape. The new method is `constant-j-segmented-brine-rk4-darcy-weisbach/1`; it is custom application coupling, not full Nexus VFP, nodal or multiphase parity.

## Inputs and public interface

```ts
hydraulics: {
  model: 'segmented-brine',
  surfaceTemperatureF: 80,
  segments: 32
}
```

`segments` is an integer from 8 through 256 describing the initial grid. The solver may refine to 4096 segments. Surface and bottomhole temperatures must lie within 60–250 °F. The bottomhole endpoint is `well.bottomholeTemperatureF` when supplied, otherwise `fluid.temperatureF`. `fluid.referencePressurePsia` still defines the exported reference property state; that state is contextual and does not supply fixed properties to the new traverse.

Geometry uses the existing MD, TVD, inner diameter and absolute roughness fields. The prescribed straight deviation has constant `dTVD/dMD=TVD/MD`. Temperature varies linearly with TVD, equivalently linearly with MD under this geometry. A horizontal trajectory requires identical temperature endpoints. No trajectory stations or heat-transfer solution are implied.

`caseHydraulicPoint(input, well, rate)` selects the case's active model. `segmentedHydraulicPoint(well, fluid, settings, rate)` evaluates the constant-J bottom boundary. `traverseBrineWell({well,fluid,settings,rateStbd,boundary})` accepts an absolute pressure boundary at `surface` or `bottomhole`. `integrateWellbore` exposes the numerical momentum integrator and a constitutive property callback; connected cases always supply the source-backed gas-free brine callback. Constant and manufactured callback fluids in the tests verify the mathematical method independently of the source PVT correlation.

## Equation, units and numerical method

For positive downward MD, the calculation integrates

`dP/dMD = rho(P,T) g dTVD/dMD − f_D rho(P,T) v(P,T)²/(2D)`.

The integrator uses SI length, velocity, density and pressure gradients, converting exported pressures to psia and pressure differences to psi. Stock-tank rate is unchanged along the well: `Q_local = q_ST × Bw(P,T) × 0.158987294928 / 86400`. The source brine convention makes `rho × Bw` constant at fixed salinity, preserving mass flow along the prescribed temperature/pressure profile. Source standard-volume conventions remain in `provenance.pvt`.

Laminar Darcy friction is `64/Re` through Re=2000. Turbulent friction at Re≥4000 adapts the retained Nexus Serghides Fanning utility and explicitly multiplies its result by four for Darcy-Weisbach. The 2000–4000 interval interpolates the two endpoint factors continuously; this transition is application code. The uniform path retains its original Swamee-Jain calculation.

Fourth-order Runge-Kutta integrates pressure and the gravity/friction contributions. Success requires the maximum change in endpoint pressure, integrated hydrostatic pressure and integrated friction pressure to be at most 0.001 psi between consecutive resolutions. The method checks a hard maximum of 4096 segments, including non-power-of-two starting grids. Coarse out-of-domain stage predictions are retried on finer grids before rejection. Geometric coordinate and temperature interpolation are bounded against endpoint floating-point roundoff; physical pressure is never clamped.

Acceleration is omitted. Any evaluated local velocity above 5 m/s is unsupported. The exported maximum kinetic head, `max(rho v²/2)` in psi, is a screening diagnostic and is not a calibrated acceleration error bound. Single-phase validity, fittings, pumps, heat transfer, dissolved gas and field calibration are outside this method.

## Coupling, capacity and failure behavior

The formation condition is `P_bh = P_res + q_ST/J`, using each well's existing declared bottomhole datum. Backward integration finds the required surface pressure. The capacity search begins within the joint upper rate `U=min(max(0,J(P_bh_limit−P_res)),operating ceiling,1000000)`; it never assumes a traverse at one million STB/day is valid.

If U has a valid feasible traverse, U is the maximum onstream envelope. Otherwise, 60 bounded bisections seek a supported feasible anchor and a valid surface-pressure violation above it. Final verification requires a valid upper pressure violation and a feasible lower pressure within 0.001 psi of the surface limit. A velocity/domain boundary alone cannot be labeled a surface capacity. Missing anchors, unresolved brackets and numerical failures block the case instead of fabricating zero capacity. Physically declared zero bounds remain shut-in.

`capacity.surfaceBoundStatus` distinguishes a surface constraint bracket from `not-binding-within-joint-upper-rate`. In the latter case `surfaceLimitedStbd=U` describes the tested bounded interval; it is not an extrapolated surface-only capacity. Availability multiplies the maximum onstream envelope exactly once. Monthly allocations retain their existing stock-tank and calendar-day conventions.

Zero-rate hydraulic points are shut-in and have null flowing pressures, with no traverse. A positive allocation outside the 100–10000 psia PVT domain or above the velocity limit returns `status:'unsupported'`, null hydraulic values, `operatingFeasible:false`, and explicit reasons. Unsupported low-rate curve/allocation points do not erase a supported high-rate envelope. Numerical integration failures block the case.

## Results, export and provenance

Flowing segmented hydraulic points add `traverse`. `traverse.points` are ordered surface to bottomhole and contain MD, TVD, pressure, temperature, Bw, density, viscosity, local flow, mass flow, velocity, Reynolds number, Darcy factor and regime. The traverse also carries integrated gravity/friction, both endpoint pressures, actual segment count, convergence residual, maximum velocity/kinetic head and diagnostic text. The top-level point's local flow/velocity/Reynolds/factor refer to the surface node.

Existing CSV export includes these complete nested profiles and metadata. Recomputed case equality protects the entire exported traverse from stale or modified displayed results. The shared exact-JSON validator checks original inputs before cloning and original export bundles before recomputation, rejecting extended/sparse arrays, accessors, hidden fields and other evidence JSON could erase or execute. JSON serialization retains the same data without a separate conversion. New units are explicit for local flow, mass flow, velocity, Reynolds number and Darcy friction factor.

The exact Nexus friction snapshot is retained at `reference/nexus-wellbore/serghides.ts`, SHA-256 `db934a2a0d850aa3375789e590ad1699fac9611157459a8bed1343da641bc4be`. This is owner-authorized local reuse; no Nexus open-source license was established. PVT files, reference fixture hashes, GPL source license and original standard-volume conventions remain separately pinned in the existing PVT provenance. No full upstream injection traverse or VFP benchmark is claimed.

## Executable evidence

`tests/wellbore-traverse.test.mjs` covers independent constant-fluid Hagen-Poiseuille gravity/friction, Colebrook turbulent anchors, local mass conservation, forward/backward boundary round-trip, grid refinement and explicit failures, source hashes, capacity/availability, unsupported low allocation, zero behavior and export recomputation. A manufactured compressible fluid has a closed-form gravity-plus-laminar pressure solution. A separate 10000-step midpoint calculation with iterated Colebrook friction checks the actual source brine solution. Additional manufactured cases catch coarse RK domain overshoot, cancellation hiding contribution error, and temperature endpoint roundoff.

The isolated build command is `node node_modules/typescript/bin/tsc -p tsconfig.json --outDir tmp/wellbore-extension/engine --declaration false`. Set `DISPOSAL_ENGINE_DIR=tmp/wellbore-extension/engine` before the focused tests. The worker's complete suite run passed 205 of 206 checks; the server test failed with sandbox loopback `connect EACCES 127.0.0.1:4188`, requiring Main's external verification. This records a gate limitation, not a server success claim.
