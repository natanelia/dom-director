// Two intentional fixtures share the existing public route. The Earth tutorial is
// the default; saved links and regression journeys can still choose the Orbit app.
if (new URLSearchParams(location.search).get('example') === 'orbit') {
  await import('./app.mjs');
} else {
  await import('./earth-demo.mjs');
}
