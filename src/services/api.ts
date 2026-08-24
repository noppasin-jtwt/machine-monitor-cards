export async function getMachines() {
  const response = await fetch(
    "http://127.0.0.1:5000/api/machines"
  );

  return response.json();
}