// lib/motivation.ts
// Kumpulan kutipan motivasi Bahasa Indonesia untuk siswa SMK.
// Fokus: disiplin, skill, masa depan, mental growth, etos kerja.

export interface MotivationQuote {
  id: number;
  text: string;
  category?: string;
}

const QUOTES: MotivationQuote[] = [
  { id: 1, text: "Setiap hadir tepat waktu adalah latihan disiplin yang nanti dibayar dengan kepercayaan." },
  { id: 2, text: "Skill itu tidak lahir dari menunda, tapi dari praktik berulang meski lelah." },
  { id: 3, text: "Jangan takut salah di bengkel / lab. Salah itu bahan bakar untuk akurat besok." },
  { id: 4, text: "Datang, fokus, selesaikan—tiga kebiasaan sederhana yang membentuk profesional." },
  { id: 5, text: "Nilai boleh biasa, tapi mental gigihmu bisa membuatmu luar biasa." },
  { id: 6, text: "SMK membekalimu senjata: keterampilan. Asah terus sebelum dilempar ke dunia kerja." },
  { id: 7, text: "Lebih baik berkembang pelan daripada diam menunggu ‘waktu yang tepat’." },
  { id: 8, text: "Kalau lelah, istirahat sebentar—bukan menyerah total." },
  { id: 9, text: "Bangun reputasi: orang yang bisa diandalkan. Itu modal karier jangka panjang." },
  { id: 10, text: "Belajar hari ini mungkin terasa kecil. Tapi kumpulannya jadi fondasi masa depanmu." },
  { id: 11, text: "Tidak ada shortcut. Konsistensi mengalahkan bakat yang malas." },
  { id: 12, text: "Tanya ketika tidak paham. Diam bukan tanda pintar, tapi bisa jadi hilang kesempatan." },
  { id: 13, text: "Kerapian laporan dan tugasmu mencerminkan cara kerjamu nanti." },
  { id: 14, text: "Ketika orang lain berhenti, kamu lanjut sedikit lagi. Di situ letak beda hasilnya." },
  { id: 15, text: "Bangun pola: Hadir. Perhatikan. Praktik. Evaluasi. Ulangi." },
  { id: 16, text: "Jangan tunggu dimotivasi guru. Latih diri untuk bergerak mandiri." },
  { id: 17, text: "Kamu tidak perlu langsung hebat. Cukup jangan berhenti memperbaiki diri." },
  { id: 18, text: "Datang adalah langkah pertama. Fokus langkah kedua. Selesai langkah ketiga." },
  { id: 19, text: "Waktu tidak kembali. Tapi skill bisa terus bertambah kalau kamu melangkah." },
  { id: 20, text: "Rendah hati belajar, tinggi mutu hasil." },
  { id: 21, text: "Hasil besar itu akumulasi kerja konsisten yang sering tidak terlihat orang lain." },
  { id: 22, text: "Jangan remehkan tugas kecil. Itu melatih akurasi dan tanggung jawabmu." },
  { id: 23, text: "Keraguan hilang kalau kamu mulai bergerak." },
  { id: 24, text: "Banyak pesaing menyerah di tengah. Jangan jadi bagian dari statistik itu." },
  { id: 25, text: "Tuliskan targetmu. Otak yang lelah sering lupa arah tanpa catatan." },
];

export function getRandomMotivation(excludeId?: number): MotivationQuote {
  if (QUOTES.length === 0) {
    return { id: 0, text: "Terus maju dan jangan menyerah." };
  }
  const filtered = excludeId ? QUOTES.filter(q => q.id !== excludeId) : QUOTES;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export function getAllMotivations(): MotivationQuote[] {
  return [...QUOTES];
}
