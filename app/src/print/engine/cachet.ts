/**
 * Image du cachet de la société (tampon), utilisée par les modèles « avec cachet ».
 * Le desktop l'embarquait dans chaque fichier .fr3 ; ici elle est choisie une fois dans
 * Paramètres › Impression et conservée sur le poste (electron-store).
 */
const CLE = 'gc.cachet';

export async function getCachet(): Promise<string | null> {
  try { return ((await window.gc?.store.get(CLE)) as string | undefined) ?? null; } catch { return null; }
}

export async function setCachet(dataUri: string | null): Promise<void> {
  try {
    if (dataUri) await window.gc?.store.set(CLE, dataUri);
    else await window.gc?.store.delete(CLE);
  } catch { /* stockage indisponible */ }
}

/** Lit un fichier image choisi par l'utilisateur en data URI (limite 1 Mo). */
export function lireImage(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fichier.type.startsWith('image/')) { reject(new Error('Choisissez une image (PNG ou JPEG).')); return; }
    if (fichier.size > 1024 * 1024) { reject(new Error('Image trop lourde (1 Mo maximum).')); return; }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Lecture de l’image impossible.'));
    r.readAsDataURL(fichier);
  });
}
