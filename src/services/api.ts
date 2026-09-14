export async function getMachines() {
  const response = await fetch(
    "http://172.20.177.186:5000/api/machines"
  );
  return response.json();
}