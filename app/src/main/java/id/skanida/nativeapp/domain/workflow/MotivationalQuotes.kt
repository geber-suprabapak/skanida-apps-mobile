package id.skanida.nativeapp.domain.workflow

data class MotivationalQuote(val quote: String, val author: String,)

object MotivationalQuotes {
    val items: List<MotivationalQuote> = listOf(
        MotivationalQuote(
            quote = "Datang tepat waktu ke bengkel sekolah adalah awal jadi teknisi profesional yang disiplin.",
            author = "Pembina Prakerin SMK",
        ),
        MotivationalQuote(
            quote = "Setiap praktik di laboratorium adalah latihan menuju dunia kerja yang menunggu keahlianmu.",
            author = "Instruktur Produktif",
        ),
        MotivationalQuote(
            quote = "Jangan remehkan tugas laporan. Administrasi rapi bikin kamu dipercaya di industri.",
            author = "Guru Produktif",
        ),
        MotivationalQuote(
            quote = "Setiap absen hadir berarti satu langkah lebih dekat dengan sertifikat kompetensi.",
            author = "Wali Kelas SMK",
        ),
        MotivationalQuote(
            quote = "Magang sukses dimulai dari semangat belajar di kelas dan workshop sekolah.",
            author = "Pembimbing Dunia Usaha",
        ),
        MotivationalQuote(
            quote = "Teknik yang kamu kuasai hari ini bisa jadi solusi nyata untuk masyarakat esok hari.",
            author = "Kepala Sekolah SMK",
        ),
        MotivationalQuote(
            quote = "Disiplin di SMK menyiapkanmu menghadapi target dan deadline di tempat kerja.",
            author = "Coach Produktivitas",
        ),
        MotivationalQuote(
            quote = "Sertifikat kompetensi dimiliki mereka yang rajin hadir, bertanya, dan mencoba.",
            author = "LSP P1",
        ),
        MotivationalQuote(
            quote = "Kerja tim di kelas proyek adalah simulasi terbaik menjadi kru profesional.",
            author = "Pembina Ekstrakurikuler",
        ),
        MotivationalQuote(
            quote = "Bahasa teknis yang kamu pelajari hari ini akan jadi bahasa kerja di perusahaan impianmu.",
            author = "Instruktur Bahasa Industri",
        ),
        MotivationalQuote(
            quote = "Skill vokasi itu tajam kalau diasah tiap hari. Hadir di kelas adalah cara termudah mengasahnya.",
            author = "Alumni SMK Sukses",
        ),
        MotivationalQuote(
            quote = "Jangan malu belajar dari kesalahan praktik. Industri butuh talenta yang mau terus memperbaiki diri.",
            author = "Pembimbing Industri",
        ),
        MotivationalQuote(
            quote = "Setiap proyek sekolah adalah portofolio nyata yang bisa kamu tunjukkan saat rekrutmen.",
            author = "HRD Mitra SMK",
        ),
        MotivationalQuote(
            quote = "SMK Hebat itu mereka yang tidak hanya hadir, tapi juga aktif bertanya dan berbagi ilmu.",
            author = "Komunitas Guru Vokasi",
        ),
    )

    fun random(): MotivationalQuote = items.random()
}
