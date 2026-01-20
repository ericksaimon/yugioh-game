
import { YGOCard } from '../types';

const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';

const TEST_IDS = {
  HERO_MAIN: ["21844576", "58932615", "84327329", "3580032", "79979666", "24094653", "45906428", "05288597", "47529357", "63035430"],
  BLUE_EYES_MAIN: ["89631139", "53183600", "39648965", "38517737", "45452205", "19613556", "83764718", "04397307", "24242562", "41130100"],
  EXTRA_P1: ["28513942", "63851859", "40854494", "10403060", "10443432"],
  EXTRA_P2: ["59822133", "45815891", "02311603", "90351981", "15461236"]
};

export const getStarterDeck = async (playerType: 'HERO' | 'Blue-Eyes'): Promise<{ main: YGOCard[], extra: YGOCard[] }> => {
  try {
    const ids = playerType === 'HERO' ? TEST_IDS.HERO_MAIN : TEST_IDS.BLUE_EYES_MAIN;
    const extraIds = playerType === 'HERO' ? TEST_IDS.EXTRA_P1 : TEST_IDS.EXTRA_P2;

    const fetchCards = async (idList: string[]) => {
      try {
        const resp = await fetch(`${BASE_URL}?id=${idList.join(',')}`);
        if (!resp.ok) return [];
        const json = await resp.json();
        return json.data || [];
      } catch (e) { return []; }
    };

    const mainPool = await fetchCards(ids);
    const extraPool = await fetchCards(extraIds);

    if (mainPool.length === 0) throw new Error("API failed");

    const main: YGOCard[] = [];
    for (let i = 0; i < 40; i++) main.push({ ...mainPool[i % mainPool.length] });
    const extra: YGOCard[] = [];
    for (let i = 0; i < 15; i++) extra.push({ ...extraPool[i % extraPool.length] });

    return { main, extra };
  } catch (error) {
    const fallback = (name: string, atk = 1000, def = 1000, id: number): YGOCard => ({
        id, name, type: "Normal Monster", desc: "Fallback card.", race: "Warrior",
        atk, def, level: 4, attribute: "LIGHT",
        card_images: [{ image_url: `https://images.ygoprodeck.com/images/cards/6983839.jpg`, image_url_small: `https://images.ygoprodeck.com/images/cards_small/6983839.jpg` }]
    });
    return { main: Array(40).fill(null).map((_, i) => fallback(`${playerType} U-${i}`, 1500, 1200, 10000 + i)), extra: [] };
  }
};
