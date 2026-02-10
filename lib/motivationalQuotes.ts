/**
 * Motivational Quotes for Students
 * Displayed after successful attendance submission
 */

export interface MotivationalQuote {
  quote: string;
  author: string;
}

export const motivationalQuotes: MotivationalQuote[] = [
  {
    quote:
      "Datang tepat waktu ke bengkel sekolah adalah awal jadi teknisi profesional yang disiplin.",
    author: "Pembina Prakerin SMK",
  },
  {
    quote:
      "Setiap praktik di laboratorium adalah latihan menuju dunia kerja yang menunggu keahlianmu.",
    author: "Instruktur Produktif",
  },
  {
    quote:
      "Jangan remehkan tugas laporan. Administrasi rapi bikin kamu dipercaya di industri.",
    author: "Guru Produktif",
  },
  {
    quote:
      "Setiap absen hadir berarti satu langkah lebih dekat dengan sertifikat kompetensi.",
    author: "Wali Kelas SMK",
  },
  {
    quote:
      "Magang sukses dimulai dari semangat belajar di kelas dan workshop sekolah.",
    author: "Pembimbing Dunia Usaha",
  },
  {
    quote:
      "Teknik yang kamu kuasai hari ini bisa jadi solusi nyata untuk masyarakat esok hari.",
    author: "Kepala Sekolah SMK",
  },
  {
    quote:
      "Disiplin di SMK menyiapkanmu menghadapi target dan deadline di tempat kerja.",
    author: "Coach Produktivitas",
  },
  {
    quote:
      "Sertifikat kompetensi dimiliki mereka yang rajin hadir, bertanya, dan mencoba.",
    author: "LSP P1",
  },
  {
    quote:
      "Kerja tim di kelas proyek adalah simulasi terbaik menjadi kru profesional.",
    author: "Pembina Ekstrakurikuler",
  },
  {
    quote:
      "Bahasa teknis yang kamu pelajari hari ini akan jadi bahasa kerja di perusahaan impianmu.",
    author: "Instruktur Bahasa Industri",
  },
  {
    quote:
      "Skill vokasi itu tajam kalau diasah tiap hari. Hadir di kelas adalah cara termudah mengasahnya.",
    author: "Alumni SMK Sukses",
  },
  {
    quote:
      "Jangan malu belajar dari kesalahan praktik. Industri butuh talenta yang mau terus memperbaiki diri.",
    author: "Pembimbing Industri",
  },
  {
    quote:
      "Setiap proyek sekolah adalah portofolio nyata yang bisa kamu tunjukkan saat rekrutmen.",
    author: "HRD Mitra SMK",
  },
  {
    quote:
      "SMK Hebat itu mereka yang tidak hanya hadir, tapi juga aktif bertanya dan berbagi ilmu.",
    author: "Komunitas Guru Vokasi",
  },
];

const getFallbackQuote = (): MotivationalQuote => {
  const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
  return motivationalQuotes[randomIndex];
};

const sanitizeQuote = (quote?: string) =>
  quote?.trim().replace(/\s+/g, " ") || "";

/**
 * Fetch a random motivational quote from the internet.
 * Falls back to local quotes when the request fails.
 */
export const fetchRandomQuote = async (): Promise<MotivationalQuote> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch("https://zenquotes.io/api/random", {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch quote: ${response.status}`);
    }

    const data = await response.json();
    const candidate = Array.isArray(data) ? data[0] : data;

    const quote = sanitizeQuote(candidate?.q ?? candidate?.quote);
    const author = sanitizeQuote(candidate?.a ?? candidate?.author);

    if (!quote) {
      throw new Error("Quote payload missing text");
    }

    return {
      quote,
      author: author || "Anonim",
    };
  } catch (error) {
    if (__DEV__) console.warn("Failed to fetch motivational quote, using fallback", error);
    return getFallbackQuote();
  } finally {
    clearTimeout(timeoutId);
  }
};

export { getFallbackQuote };
