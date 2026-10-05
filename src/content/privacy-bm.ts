import type { InformationSection } from "@/components/public-information/public-information";
import { productionReleasePolicy } from "../../functions/src/release-policy.ts";
import { legalPublicationReadiness } from "../../functions/src/legal-publication.ts";
import { marketplaceOperator } from "./operator.ts";

// Bahasa Melayu owner draft. The same central approvals control both languages.
export const bmPrivacyDocument = Object.freeze({
  title: "Notis Privasi TAKEME",
  language: "Bahasa Melayu",
  version: productionReleasePolicy.privacyVersion,
  minimumAge: productionReleasePolicy.minimumAge,
  effectiveDate: legalPublicationReadiness.effectiveDate,
  lastUpdated: legalPublicationReadiness.lastUpdated,
  operator: marketplaceOperator,
  businessAddress: null,
  businessAddressStatus: "LEGAL REVIEW / OWNER INPUT REQUIRED",
  localizedBusinessAddressStatus: "SEMAKAN UNDANG-UNDANG / INPUT PEMILIK DIPERLUKAN",
  legalReviewMarker: "SEMAKAN UNDANG-UNDANG DIPERLUKAN",
  reviewNotice: "Draf pemilik dalam Bahasa Melayu untuk semakan undang-undang Malaysia. Notis ini belum berkuat kuasa dan belum diterbitkan. Kelulusan undang-undang muktamad bagi versi Bahasa Inggeris dan Bahasa Melayu, tarikh pelancaran awam sebenar serta kelulusan penerbitan yang berasingan masih diperlukan.",
});

export const bmPrivacySections: InformationSection[] = [
  { id: "about", title: "1. Siapa Kami", paragraphs: [
    "TAKEME dikendalikan oleh " + marketplaceOperator.name + " (No. Pendaftaran SSM " + marketplaceOperator.registrationNumber + "). Hubungi kami untuk urusan privasi dan sokongan melalui " + marketplaceOperator.privacyLegalEmail + ".",
    "Draf pemilik dalam Bahasa Melayu ini menerangkan amalan data peribadi TAKEME V1. Draf ini bukan kelulusan muktamad penasihat undang-undang Malaysia atau kebenaran untuk menerbitkan atau mengaktifkan notis ini.",
  ] },
  { id: "scope", title: "2. Skop Notis Privasi Ini", paragraphs: [
    "Notis ini meliputi pendaftaran dan log masuk akaun, profil, penyenaraian dan foto, mesej, tawaran, urus niaga yang dipersetujui, lelongan dan bidaan, Updates dalam aplikasi, Saved dan tindakan mengikuti, penemuan, keutamaan, laporan, sokongan, penerimaan polisi serta aliran pemadaman akaun.",
    "TAKEME membantu pembeli dan penjual mengatur pertukaran mereka secara langsung. V1 semasa tidak memproses butiran kad pembayaran melalui Stripe, bayaran kepada penjual atau pembayaran bersepadu dengan perlindungan, dan tidak menyediakan penghantaran/AWB bersepadu, Seller Centre, perdagangan melalui siaran langsung atau perdagangan melalui video pendek. Perkhidmatan masa hadapan memerlukan semakan privasi lanjut sebelum pengumpulan data bermula.",
    "Draf ini menerangkan perkhidmatan web yang telah disemak dan seni bina pematuhan yang dirancang. Draf ini tidak mengesahkan aplikasi natif masa hadapan atau memperkenalkan pengumpulan data pemberitahuan push natif atau analitik V2 masa hadapan.",
  ] },
  { id: "categories", title: "3. Data Peribadi yang Kami Kumpulkan", paragraphs: [
    "Data peribadi boleh mengenal pasti anda secara langsung atau kekal dikaitkan dengan akaun atau aktiviti marketplace anda. Kategori di bawah meliputi maklumat yang anda berikan, rekod aktiviti yang disokong dan dijana oleh perkhidmatan, serta maklumat identiti yang dibekalkan oleh penyedia log masuk yang anda pilih.",
  ], bullets: [
    "Akaun dan pengesahan: e-mel, pengecam akaun dan penyedia, status log masuk/akaun serta cap masa yang berkaitan.",
    "Profil dan kandungan marketplace: nama paparan, foto profil, maklumat profil yang diberikan secara sukarela, kawasan umum, penyenaraian, foto, harga, kategori, bidaan, tawaran dan rekod urus niaga.",
    "Komunikasi dan sokongan: mesej marketplace peribadi, e-mel sokongan, butiran laporan/aduan serta bukti pertikaian yang berkaitan.",
    "Keutamaan dan aktiviti: item Saved, tindakan mengikuti, carian tersimpan, tetapan pemberitahuan serta isyarat penemuan marketplace yang disokong.",
    "Rekod teknikal dan pematuhan: pengecam operasi, cap masa, rekod keselamatan/kawalan kadar yang terhad serta bukti penerimaan Terma/Privasi/pengesahan 18+ secara nyata.",
  ] },
  { id: "provided", title: "4. Data yang Diberikan oleh Pengguna", paragraphs: [
    "Anda memberikan maklumat akaun, butiran profil, teks/foto penyenaraian serta mesej atau tawaran marketplace apabila menggunakan ciri tersebut. E-mel sokongan dan laporan boleh mengandungi maklumat yang anda pilih untuk berikan.",
    "Foto profil, alamat peribadi dan carian tersimpan adalah pilihan. Identiti akaun diperlukan untuk ciri yang memerlukan pengesahan; butiran item dan foto yang berkaitan diperlukan untuk menerbitkan penyenaraian. Jika anda tidak memberikan maklumat yang diperlukan, ciri berkenaan tidak dapat dilengkapkan. Anda masih boleh melayari kandungan marketplace awam yang diluluskan.",
    "Baris alamat peribadi, poskod, bandar, negeri dan negara ialah maklumat untuk akaun sahaja. Nama tempat pertemuan dan kawasan umum yang disimpan kekal peribadi sehingga anda memilih secara nyata butiran tempat pertemuan untuk disalin ke dalam penyenaraian. Memadamkan tempat tersimpan tidak mengubah salinan butiran dalam penyenaraian sedia ada secara automatik. Jangan masukkan alamat rumah peribadi, maklumat kelayakan log masuk atau butiran sensitif yang tidak perlu ke dalam teks, foto atau mesej awam.",
  ] },
  { id: "authentication", title: "5. Data Akaun dan Pengesahan", paragraphs: [
    "Firebase Authentication mengendalikan log masuk e-mel/kata laluan dan Google. Data akaun merangkumi pengecam pengesahan/akaun anda, e-mel, identiti penyedia yang dihubungkan, status akaun serta cap masa penciptaan/log masuk yang berkaitan. Log masuk Google boleh membekalkan nama paparan dan foto profil yang dikaitkan dengan identiti yang anda pilih.",
    "Firebase mengendalikan maklumat kelayakan dan sesi log masuk. TAKEME tidak menyimpan kata laluan anda dalam dokumen profil marketplace atau mesej. E-mel tetapan semula kata laluan ialah mesej pengesahan, berasingan daripada makluman marketplace. Pemadaman akaun atau pengesahan semula tidak memadamkan akaun Google anda.",
    "Pelayaran awam tidak memerlukan akaun. Log masuk, muat semula dan pelayaran tidak dikira sebagai penerimaan Privasi atau Terma. Penerimaan Terma/Privasi semasa secara nyata serta pengesahan 18+ diperlukan sebelum tindakan marketplace terlindung yang menulis data seperti Sell, Chat, Offer, Bid, Save, Follow dan muat naik.",
  ] },
  { id: "profile", title: "6. Data Profil", paragraphs: [
    "Nama paparan awam, foto profil, maklumat keahlian, daerah/bandar dan negeri umum untuk marketplace serta penilaian/ulasan penjual atau reputasi yang tersedia boleh dipaparkan kepada pelawat marketplace. Profil atau penilaian bukan bukti ketulenan item atau pendaftaran perniagaan.",
    "E-mel akaun, alamat peribadi, rekod persediaan akaun peribadi dan penerimaan polisi anda bukan sebahagian daripada profil marketplace awam. Paparan awam penjual menggunakan medan marketplace yang dibenarkan; alamat peribadi tidak disalin secara automatik ke profil, penyenaraian atau penemuan.",
    "Ciri lokasi berstruktur menggunakan maklumat yang anda masukkan. Ciri ini tidak meminta GPS peranti atau membuat inferens lokasi langsung yang tepat. Salinan butiran tempat pertemuan/kawasan umum menjadi kelihatan kepada umum hanya apabila anda memilihnya secara nyata untuk penyenaraian.",
  ] },
  { id: "listings", title: "7. Kandungan Penyenaraian dan Produk", paragraphs: [
    "Penyenaraian menyimpan tajuk, penerangan, kategori, keadaan, harga, foto, jenis penyenaraian, rujukan penjual, lokasi awam yang dipilih serta status. Penyenaraian dan foto yang diterbitkan ialah kandungan marketplace awam; draf ialah kandungan yang diurus melalui akaun.",
    "Imej diproses dan disimpan untuk memaparkan penyenaraian dan foto profil. Jangan masukkan maklumat peribadi yang tidak perlu dalam imej. Notis ini tidak menjanjikan bahawa metadata terbenam dibuang daripada semua imej yang dimuat naik.",
    "Ulasan yang diterbitkan boleh merangkumi penilaian, tag yang telah ditetapkan dan komen tentang peranan pembeli atau penjual yang layak. Penyerahan ulasan peribadi dan butiran urus niaga menggunakan akses akaun atau peserta yang dibenarkan. Penilaian/sejarah tulen yang terhad boleh kekal selepas identiti diminimumkan mengikut peraturan pemadaman.",
    "Jika anda menyimpan permintaan promosi penyenaraian, TAKEME menyimpan rujukan penjual/penyenaraian, pakej/jenis yang dipilih, contoh harga/tempoh, status permintaan/persediaan pembayaran serta cap masa. Checkout, pembayaran dan pengaktifan berbayar masih tidak tersedia; menyimpan permintaan tidak membeli penempatan tambahan atau mengambil bayaran.",
  ] },
  { id: "communications", title: "8. Pemesejan, Tawaran dan Lelongan", paragraphs: [
    "TAKEME memproses perbualan peribadi antara peserta, kandungan mesej teks biasa, rujukan pengirim/peserta, cap masa, konteks penyenaraian/urus niaga/tawaran, pratonton serta kiraan belum dibaca untuk menyediakan komunikasi marketplace. Perbualan ini bukan kandungan awam. Pemesej semasa tidak menyokong lampiran, penunjuk sedang menaip atau pengesahan mesej telah dibaca.",
    "Tawaran/tawaran balas menyimpan peserta, jumlah yang dicadangkan atau dipersetujui, status, tamat tempoh serta label pengaturan pembayaran yang disokong. Urus niaga merekodkan pengesahan peserta, maklumat pembatalan/pertikaian serta kelayakan ulasan. Ini ialah rekod persetujuan marketplace, bukan data kad pembayaran atau resit pembayaran platform.",
    "Lelongan merekodkan jumlah permulaan, kenaikan bidaan, masa, bidaan, rujukan pembida, jumlah semasa/akhir serta keputusan. Paparan lelongan awam boleh menunjukkan jumlah/keputusan serta maklumat pembida yang terhad tanpa e-mel akaun peribadi. Sejarah yang diperlukan mengekalkan keputusan lelongan yang tulen.",
    "Konteks mesej atau urus niaga yang berkaitan dan terhad boleh disemak oleh kakitangan yang diberi kuasa apabila perlu bagi laporan, kebimbangan keselamatan, pertikaian atau siasatan sokongan. Ini tidak bermakna kakitangan membaca semua mesej secara rutin. Peserta lain boleh menyimpan salinan mereka sendiri di luar TAKEME.",
  ] },
  { id: "preferences", title: "9. Saved, Mengikuti dan Keutamaan", paragraphs: [
    "TAKEME menyimpan penyenaraian/lelongan Saved anda, penjual yang diikuti, carian yang disimpan secara nyata serta penapis/keutamaan makluman yang disokong. Hubungan dan keutamaan peribadi tersebut adalah peribadi; profil penjual awam boleh menunjukkan jumlah pengikut terkumpul tanpa mendedahkan identiti pengikut.",
    "Updates dalam aplikasi mengandungi rujukan penyenaraian/urus niaga yang berkaitan, teks pemberitahuan, masa penciptaan/dibaca/dibuka, ringkasan belum dibaca serta keutamaan. Kategori makluman pilihan yang disokong boleh diurus dalam Tetapan; kemas kini penting tentang tawaran, urus niaga, pertikaian dan kemenangan lelongan kekal diaktifkan.",
    "Keutamaan ini mempengaruhi makluman dalam aplikasi yang disokong. Pemberitahuan push natif, makluman marketplace melalui e-mel/SMS serta ringkasan harian tidak aktif dalam perkhidmatan web semasa. E-mel tetapan semula kata laluan untuk pengesahan adalah berasingan.",
  ] },
  { id: "technical", title: "10. Data Teknikal dan Keselamatan", paragraphs: [
    "TAKEME merekodkan pengecam aktiviti/operasi yang berkaitan, cap masa, kaunter kawalan kadar yang dikaitkan dengan akaun, kebenaran muat naik serta hasil operasi yang diperlukan untuk kebolehpercayaan perkhidmatan, percubaan semula yang selamat dan pencegahan penyalahgunaan. Pengecam tersebut boleh kekal dikaitkan dengan akaun; pengecam itu tidak menjadi tanpa nama secara automatik.",
    "Penyedia pengesahan dan pengehosan boleh memproses maklumat rangkaian, permintaan dan pelayar yang diperlukan untuk menyampaikan dan melindungi perkhidmatan mereka. Pemprosesan oleh penyedia tersebut berbeza daripada rekod marketplace TAKEME. Sumber aplikasi semasa tidak melaksanakan pengecaman cap jari peranti atau pengumpulan khusus alamat IP tepat, pengecam pengiklanan, kenalan peranti atau GPS langsung yang tepat.",
    "Log operasi sepatutnya mengandungi hanya maklumat yang munasabah diperlukan untuk keselamatan dan penyelesaian masalah. Butiran penyedia/log serta tempoh penyimpanan terhad memerlukan semakan muktamad; notis ini tidak mendakwa bahawa setiap rekod teknikal dipadamkan melalui pembersihan akaun dalam sistem aktif.",
  ] },
  { id: "support", title: "11. Sokongan, Laporan dan Pertikaian", paragraphs: [
    "Komunikasi sokongan menggunakan e-mel hubungan yang anda pilih untuk menulis kepada kami. Laporan boleh mengandungi pelapor, sasaran, sebab, butiran, status serta konteks penyenaraian, penjual atau perbualan/mesej yang berkaitan dan terhad. Pertikaian urus niaga boleh mengandungi sebab yang diberikan oleh peserta dan rekod penyelesaian.",
    "Kakitangan yang diberi kuasa boleh menyemak bukti yang berkaitan serta nota pentadbiran peribadi apabila perlu untuk sokongan, keselamatan, pencegahan penipuan, pengendalian pertikaian atau pematuhan undang-undang. Pengguna biasa yang tidak berkaitan tidak boleh mengakses laporan terhad, bukti sokongan, nota pentadbiran atau rekod pemadaman/keselamatan.",
    "Berikan maklumat yang berkaitan dan benar tanpa butiran sensitif yang tidak perlu. Laporan tidak menjamin keputusan, masa respons, bayaran balik atau penyelesaian pertikaian automatik. Bukti kes tertakluk kepada penyimpanan yang terhad dari segi akses dan tempoh, bukan penyimpanan kekal secara lalai.",
  ], links: [{ href: "mailto:" + marketplaceOperator.supportEmail, label: "Hubungi sokongan TAKEME" }] },
  { id: "acceptance", title: "12. Bukti Penerimaan Polisi", paragraphs: [
    "TAKEME menyimpan bukti peribadi yang direkodkan oleh pelayan tentang penerimaan secara nyata: versi Terma dan Privasi yang diterima, pengesahan 18+, cap masa yang dikawal oleh pelayan, sumber web serta konteks keluaran yang disokong. TAKEME juga menyimpan rekod kelayakan semasa yang terhad untuk menyemak tindakan marketplace terlindung.",
    "Sejarah penerimaan tidak boleh diubah dalam proses penerimaan dan penerimaan semula biasa: persetujuan baharu tidak menulis ganti bukti sah terdahulu, dan percubaan semula tidak mencipta persetujuan yang direka-reka. Rekod sejarah masih merupakan data peribadi yang tertakluk kepada pembersihan pemadaman akaun yang diluluskan; tidak boleh diubah bukan bermakna disimpan selama-lamanya.",
    "Hanya penerimaan secara nyata mencipta atau mengemas kini bukti persetujuan. Log masuk, muat semula, semakan status atau pelayaran sahaja tidak pernah dikira sebagai penerimaan. Bukti sah terdahulu dikekalkan bersama cap masa asalnya apabila migrasi yang telah disemak terpakai; persetujuan yang tiada tidak direka-reka.",
    "Bukti ini menentukan kelayakan semasa, mengekalkan bukti pematuhan serta menyokong penerimaan semula pada masa hadapan. Bukti ini tidak merangkumi tarikh lahir, dokumen pengenalan, alamat IP, cap jari pelayar, kuki atau token pengesahan.",
  ] },
  { id: "uses", title: "13. Bagaimana Kami Menggunakan Data Peribadi", bullets: [
    "Mencipta dan mengurus akaun, mengesahkan pemilik serta menggunakan kawalan akaun/kitaran hayat yang disokong.",
    "Memaparkan penyenaraian/profil awam serta membolehkan mesej, tawaran, lelongan, urus niaga yang dipersetujui, Saved, tindakan mengikuti dan Updates dalam aplikasi.",
    "Menyediakan penemuan yang berkaitan apabila dilaksanakan serta menghormati keutamaan yang disokong.",
    "Menyokong pengguna, menyiasat laporan/pertikaian serta mencegah penipuan atau penyalahgunaan.",
    "Melindungi keselamatan/kebolehpercayaan perkhidmatan, menguatkuasakan Terma, mengekalkan rekod yang diperlukan serta mematuhi undang-undang yang terpakai.",
    "Mengurus penerimaan/penerimaan semula polisi secara nyata serta permintaan pemadaman akaun.",
  ], paragraphs: [
    "Tujuan ini berkaitan dengan marketplace yang disokong serta pematuhan/operasi yang diperlukan. Notis ini tidak memperkenalkan pemprofilan pengiklanan yang luas atau pengumpulan data untuk ciri yang tidak tersedia.",
  ] },
  { id: "compliance", title: "14. Tujuan Undang-Undang, Pematuhan dan Keselamatan", paragraphs: [
    "Rekod akaun, marketplace, penerimaan dan kes yang berkaitan boleh digunakan untuk menguatkuasakan Terma, menentukan kelayakan, menjawab permintaan yang sah di sisi undang-undang, menyiasat kebimbangan penipuan/keselamatan serta mengekalkan rekod apabila diwajibkan oleh undang-undang yang terpakai. Penggunaan dan pendedahan hendaklah terhad kepada tujuan yang sah.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — keperluan statutori yang tepat, tanggungjawab marketplace/operator, percanggahan antara penyimpanan dan pemadaman, kewajipan pemberitahuan pelanggaran data serta pemakaian keperluan DPO. Draf ini tidak mendakwa pensijilan pematuhan telah selesai atau Pegawai Perlindungan Data telah dilantik.",
  ] },
  { id: "operations", title: "15. Tujuan Operasi Marketplace", paragraphs: [
    "Perkhidmatan menggunakan kandungan penyenaraian/profil untuk paparan awam dan penemuan, rekod peserta untuk mesej/tawaran/urus niaga, data lelongan untuk turutan bidaan/keputusan serta Saved/tindakan mengikuti/keutamaan untuk ciri akaun dan makluman yang disokong.",
    "Rekod pengesahan, ulasan, pemberitahuan serta pengecam operasi menyokong sejarah marketplace yang benar, percubaan semula yang selamat dan kebolehpercayaan perkhidmatan. TAKEME tidak mereka-reka hasil pembayaran, penghantaran, bidaan atau urus niaga.",
    "Data bukan awam tidak dijadikan awam hanya kerana data itu digunakan untuk mengendalikan sesuatu ciri. E-mel akaun, alamat peribadi, peti masuk, bukti penerimaan serta rekod keutamaan peribadi kekal di luar paparan marketplace awam biasa.",
  ] },
  { id: "discovery", title: "16. Personalisasi dan Penemuan", paragraphs: [
    "Bagi pengguna yang telah log masuk, paparan penyenaraian/lelongan, carian yang dihantar, tindakan kategori/penapis, simpanan, bidaan, tindakan pemesejan, paparan/klik cadangan, Not interested/Undo serta aktiviti urus niaga yang selesai boleh menjana isyarat marketplace apabila disokong.",
    "Profil minat peribadi, rekod item yang benar-benar ditunjukkan serta atribusi klik/simpanan membantu menyusun item yang berkaitan, mengelakkan paparan berulang, menghormati pilihan yang disokong serta mengukur aktiviti ciri marketplace. Pentadbiran yang diberi kuasa boleh menggunakan ukuran agregat.",
    "Ini ialah aktiviti dalam TAKEME, bukan rekod pelayaran laman web lain. Alamat peribadi tidak digunakan untuk menentukan paparan penemuan awam. Pelaksanaan semasa tidak membina profil pengiklanan berasaskan tingkah laku di luar TAKEME.",
  ] },
  { id: "fraud", title: "17. Pencegahan Penipuan dan Penyalahgunaan", paragraphs: [
    "Semakan pemilikan/peserta, rekod operasi serta rekod kawalan kadar yang terhad membantu mengesan atau mencegah mesej, tawaran, bidaan, laporan, aktiviti penyenaraian/draf atau muat naik berulang yang bersifat penyalahgunaan. Kandungan yang dilaporkan dan berkaitan boleh dipertimbangkan untuk siasatan keselamatan yang sah.",
    "Bukti keselamatan/penipuan bukan arkib lalai tanpa had masa. Sebarang penahanan data terhad yang nyata memerlukan tujuan yang didokumenkan, akses terhad dan tarikh luput di bawah model yang telah disemak. SEMAKAN UNDANG-UNDANG DIPERLUKAN — asas undang-undang muktamad serta penyelarasan penyimpanan/pemadaman.",
  ] },
  { id: "providers", title: "18. Penyedia Perkhidmatan", paragraphs: [
    "Firebase/Google Cloud menyediakan Authentication, Cloud Firestore, Cloud Storage dan Cloud Functions untuk identiti, rekod marketplace, foto yang dimuat naik, operasi yang dibenarkan serta pemprosesan berjadual. Google juga ialah penyedia log masuk apabila anda memilih pengesahan Google; foto profil yang dihoskan oleh Google boleh dipaparkan.",
    "Seni bina pengehosan yang telah disemak menggunakan Cloudflare Workers untuk menyampaikan laman web dan memproses permintaan web. Netlify kekal sebagai penyedia pengehosan/pemulihan sementara semasa migrasi. Pertanyaan sokongan dan privasi menggunakan alamat Gmail yang diterbitkan; ini bukan dakwaan bahawa platform tiket sokongan bersepadu tersedia.",
    "Penyedia memproses maklumat yang berkaitan untuk menyampaikan, mengesahkan, mengehos dan melindungi perkhidmatan. Infrastruktur, log teknikal dan sandaran mereka dikendalikan secara berasingan daripada pembersihan marketplace aktif TAKEME.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — butiran pendedahan penyedia yang muktamad, perkhidmatan sebenar yang aktif ketika pelancaran awam, pengaturan pemprosesan serta tempoh penyimpanan penyedia/log yang terhad. Draf ini tidak memberikan negara pemprosesan yang belum disahkan atau jaminan lokasi untuk semua perkhidmatan.",
  ], links: [{ href: "https://firebase.google.com/support/privacy", label: "Maklumat privasi dan keselamatan Firebase" }] },
  { id: "sharing", title: "19. Perkongsian Data", paragraphs: [
    "TAKEME tidak menjual data peribadi kepada pengiklan. TAKEME tidak menjual data peribadi sebagai perkhidmatan marketplace. Tiada penjejak pengiklanan luaran atau SDK analitik pemasaran pihak ketiga yang aktif dalam pelaksanaan web semasa.",
    "Perkongsian data terhad kepada paparan marketplace yang berkaitan, komunikasi antara peserta, penyedia perkhidmatan serta tujuan pentadbiran, keselamatan atau undang-undang yang perlu dan sah. Menerbitkan penyenaraian tidak menjadikan e-mel akaun, alamat peribadi, peti masuk, sejarah penerimaan atau keutamaan anda awam.",
    "Apabila terpakai dan perlu, maklumat yang terhad boleh diberikan kepada pihak berkuasa menurut undang-undang atau untuk siasatan penipuan/keselamatan yang sah atau nasihat undang-undang yang berkaitan. Draf ini tidak mendakwa perkongsian rutin dengan penanggung insurans, juruaudit atau pembeli korporat apabila tiada amalan semasa sedemikian yang telah dikenal pasti.",
  ], bullets: [
    "Pelawat marketplace melihat kandungan profil awam, penyenaraian, ulasan serta lokasi awam terpilih yang anda terbitkan.",
    "Peserta perbualan/urus niaga menerima maklumat yang diperlukan untuk interaksi mereka.",
    "Penyedia yang berkaitan memproses maklumat yang diperlukan untuk mengehos, mengesahkan dan mengendalikan perkhidmatan.",
    "Kakitangan yang diberi kuasa menyemak maklumat akaun/kes yang berkaitan hanya untuk tujuan sokongan, keselamatan, pentadbiran atau undang-undang yang sah.",
  ] },
  { id: "transfers", title: "20. Pemprosesan Antarabangsa dan Rentas Sempadan", paragraphs: [
    "Penyedia perkhidmatan boleh memproses atau menyimpan data di luar Malaysia bergantung pada infrastruktur dan pengaturan perkhidmatan mereka. Rantau Functions yang dipilih tidak menentukan lokasi setiap perkhidmatan, sandaran atau log operasi.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — rumusan muktamad tentang pemindahan antarabangsa, syarat/perlindungan yang terpakai, pengaturan penyedia sebenar serta lokasi pemprosesan. Tiada negara dinamakan tanpa pengesahan dan tiada dakwaan bahawa semua data kekal di Malaysia.",
  ] },
  { id: "retention", title: "21. Penyimpanan Data", paragraphs: [
    "Data akaun/profil dan marketplace yang aktif disimpan selama diperlukan untuk tujuan yang disokong, tertakluk kepada undang-undang yang terpakai serta model penyimpanan yang diluluskan. Tempoh berkaitan pemadaman di bawah bukan tempoh hayat menyeluruh bagi setiap rekod akaun aktif.",
    "Pembersihan memadamkan atau meminimumkan data peribadi dalam sistem aktif serta mengehadkan sejarah marketplace berpseudonim dan bukti terhad yang diperlukan. Rekod berpseudonim tidak semestinya tanpa nama. Medan tarikh luput atau pembersihan yang masih belum selesai bukan bukti bahawa setiap salinan fizikal telah pun hilang.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — keperluan penyimpanan rekod marketplace Malaysia dan penyelarasannya dengan tempoh pemadaman sedia ada, rekod/titik mula tepat yang terpakai serta sebarang penyimpanan statutori yang diperlukan. Draf ini tidak mengubah jadual backend atau melanjutkan rekod secara senyap kepada tempoh statutori baharu.",
  ], bullets: [
    "Rekod operasi pemadaman yang berjaya dan rekod audit: 30 hari selepas selesai mengikut peraturan pembersihan yang diluluskan.",
    "Sejarah mesej pihak satu lagi yang kekal: sehingga 90 hari selepas urus niaga berkaitan ditutup; sejarah perbualan tanpa urus niaga dihadkan kepada 90 hari dari pembersihan, tertakluk kepada penahanan bukti terhad yang diluluskan.",
    "Rekod minimum berpseudonim bagi urus niaga yang telah ditutup serta sejarah marketplace berkaitan: dihadkan kepada 12 bulan kalendar mengikut peraturan pembersihan yang diluluskan. Sejarah yang dikaitkan dengan urus niaga menggunakan tarikh penutupan; sesetengah sejarah berkaitan menggunakan tarikh pembersihannya.",
    "Bukti laporan/pertikaian yang ditutup: sehingga 180 hari selepas penutupan. Kes terbuka kekal terhad sehingga penyelesaian yang sah.",
    "Bukti keselamatan/penipuan: tujuan yang nyata dan didokumenkan, akses terhad serta tarikh luput diperlukan; tiada penahanan tanpa had masa secara lalai.",
    "Sandaran dan log operasi: tempoh terhad yang berasingan serta prosedur pemulihan yang menghormati pemadaman memerlukan semakan dan pelaksanaan di luar pembersihan dalam aliran sistem aktif.",
  ] },
  { id: "deletion", title: "22. Pemadaman Akaun", paragraphs: [
    "Anda boleh meminta pemadaman akaun dalam Tetapan atau melalui halaman pemadaman akaun awam selepas log masuk dan mengesahkan pemilikan menggunakan penyedia pengesahan sedia ada. Permintaan, status belum selesai atau percubaan yang gagal bukan pemadaman yang telah selesai. Pelaksanaan pemadaman dalam produksi masih dimatikan sementara menunggu pengesahan kesediaan dan kelulusan pengaktifan yang berasingan.",
    "Pembersihan yang dilaksanakan memadamkan atau meminimumkan profil awam, alamat peribadi, tempat pertemuan tersimpan, Saved/tindakan mengikuti/carian, keutamaan, pemberitahuan, rekod penemuan peribadi serta sejarah penerimaan. Penyenaraian/draf yang selamat untuk dipadam dan muat naik milik pengguna dibersihkan apabila peringkat berkenaan membenarkannya. Konteks lelongan aktif yang diperlukan kekal sehingga kewajipan diselesaikan.",
    "Mesej yang ditulis oleh pengguna yang memadamkan akaun dan pratonton yang disalin dibuang/disunting untuk memadamkan kandungannya, identiti menjadi Deleted user, dan sejarah pihak satu lagi yang diperlukan dihadkan. Ulasan tentang profil yang dipadamkan dibuang; penilaian/tag tulen yang terhad tentang ahli yang kekal boleh disimpan dengan identiti pengguna yang memadamkan akaun/teks bebas diminimumkan. TAKEME tidak mereka-reka atau menulis semula hasil marketplace.",
    "Lelongan aktif yang mempunyai bidaan, urus niaga belum selesai, laporan/pertikaian yang belum diselesaikan atau kewajipan lama yang tidak pasti boleh menyebabkan permintaan kekal belum selesai. Siasatan penipuan/keselamatan, penahanan data atas sebab undang-undang atau kewajipan statutori juga boleh menangguhkan atau mengehadkan pemadaman secara sah, tertakluk kepada penyelarasan — SEMAKAN UNDANG-UNDANG DIPERLUKAN; ini bukan dakwaan bahawa setiap penahanan tersebut sudah menjadi sekatan automatik.",
    "Kejayaan akhir dipaparkan hanya selepas pembersihan yang diperlukan dan pemadaman Firebase Auth berjaya. Sesetengah data boleh dipadamkan segera dan sesetengahnya disimpan atau dipseudonimkan sementara. Sandaran, log dan salinan pengguna lain mungkin tidak hilang serta-merta; tiada janji pemadaman semua data serta-merta.",
  ], links: [{ href: "/account-deletion", label: "Butiran dan permintaan pemadaman akaun" }] },
  { id: "holds", title: "23. Penahanan Data atas Sebab Undang-Undang, Pertikaian, Sandaran dan Log", paragraphs: [
    "Bukti laporan/pertikaian atau penipuan/keselamatan yang berkaitan boleh memerlukan pengendalian terhad selagi kes atau kewajipan yang sah masih wujud. Penahanan keselamatan/penipuan yang nyata memerlukan tujuan yang didokumenkan serta tarikh luput. Bukti laporan/pertikaian terbuka boleh menunggu penyelesaian yang sah sebelum tarikh luput terhad berdasarkan penutupannya ditetapkan. Dakwaan umum tentang penyimpanan statutori tidak secara automatik menentukan skop undang-undang yang diperlukan.",
    "Sandaran terlindung dan log operasi berada di luar pemadaman dalam aliran sistem aktif. Sandaran dan log ini sepatutnya menyimpan hanya maklumat yang munasabah diperlukan untuk keselamatan, penyelesaian masalah, pencegahan penipuan, pemulihan bencana serta tanggungjawab undang-undang, bagi tempoh terhad yang didokumenkan.",
    "Prosedur pemulihan yang diluluskan menghendaki status pemadaman/pembersihan digunakan semula sebelum data pengguna yang telah dipadamkan dan dipulihkan menjadi aktif semula. Sandaran tidak boleh menghidupkan semula akaun yang dipadamkan kecuali apabila perlu secara teknikal untuk pemulihan bencana atau diwajibkan oleh prosedur keselamatan yang sah. Ini ialah keperluan operasi, bukan dakwaan bahawa setiap laluan pemulihan sudah diautomatikkan atau setiap sandaran telah luput.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — penahanan data atas sebab undang-undang, pertikaian, tempoh sandaran/log, kawalan pemulihan serta percanggahan penyimpanan/pemadaman statutori. Notis ini tidak mewujudkan simpanan bukti tanpa had masa.",
  ] },
  { id: "security", title: "24. Keselamatan", paragraphs: [
    "TAKEME menggunakan langkah perlindungan teknikal dan organisasi yang direka untuk melindungi data, termasuk akses yang disahkan dan dibenarkan serta pengendalian rekod peribadi yang terhad. Tiada perkhidmatan dalam talian boleh menjamin keselamatan mutlak.",
    "Rahsiakan maklumat kelayakan log masuk dan kod pengesahan, gunakan akaun milik anda serta elakkan data peribadi yang tidak perlu dalam kandungan awam atau Chat. Hubungi TAKEME jika anda mengesyaki masalah akaun atau privasi.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — kewajipan pemberitahuan pelanggaran data yang terpakai, tanggungjawab insiden serta pemakaian keperluan DPO. Tiada tarikh akhir respons statutori muktamad, sistem pemberitahuan pelanggaran data automatik atau janji keselamatan mutlak yang diluluskan oleh draf ini.",
  ] },
  { id: "rights", title: "25. Hak Anda di Bawah Undang-Undang yang Terpakai", paragraphs: [
    "Apabila terpakai di bawah undang-undang Malaysia, anda boleh meminta akses kepada atau pembetulan data peribadi, menarik balik persetujuan apabila berkaitan, memohon batasan pemprosesan yang diperuntukkan oleh undang-undang, membuat aduan privasi atau meminta pemadaman akaun tertakluk kepada kewajipan yang sah serta had penyimpanan.",
    "Hubungi " + marketplaceOperator.privacyLegalEmail + " dengan permintaan anda. Semakan pemilikan/identiti yang munasabah mungkin diperlukan sebelum data peribadi didedahkan atau diubah. Jangan hantar kata laluan atau kod pengesahan. Anda juga boleh menggunakan kawalan profil, keutamaan dan pemadaman yang disokong.",
    "Menarik balik persetujuan atau menolak penerimaan semasa boleh mempengaruhi ciri terlindung. Pelayaran awam tidak dengan sendirinya mewujudkan persetujuan. Pertanyaan privasi atau permintaan penarikan balik tidak menjanjikan pemadaman automatik rekod yang diperlukan untuk tujuan yang sah atau menurut undang-undang.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — rumusan hak statutori muktamad, pengecualian yang terpakai, proses permintaan serta saluran aduan. Draf ini tidak secara automatik menjanjikan hak seperti GDPR, kebolehpindahan data sejagat atau tarikh akhir respons yang direka-reka.",
  ], links: [{ href: "mailto:" + marketplaceOperator.privacyLegalEmail, label: "Pertanyaan privasi" }, { href: "/profile/settings", label: "Urus tetapan akaun" }] },
  { id: "age", title: "26. Kanak-Kanak dan Umur Minimum", paragraphs: [
    "TAKEME V1 menghendaki pengguna akaun berumur sekurang-kurangnya " + bmPrivacyDocument.minimumAge + " tahun (18 tahun ke atas, 18+). Pengguna di bawah 18 tahun tidak sepatutnya mencipta akaun atau menggunakan ciri marketplace terlindung. Tiada fungsi akaun kanak-kanak disediakan.",
    "Pendaftaran memerlukan pengesahan 18+ secara nyata. TAKEME tidak mengumpulkan tarikh lahir atau mengesahkan umur secara bebas melalui dokumen pengenalan atau biometrik pada masa ini. Jangan memberikan gambaran palsu tentang umur anda atau menyerahkan maklumat kanak-kanak yang tidak perlu.",
  ] },
  { id: "storage", title: "27. Storan Pelayar, Kuki dan Analitik", paragraphs: [
    "Firebase Authentication boleh mengekalkan status log masuk dalam storan pelayar apabila disokong supaya sesi akaun dapat berterusan. SDK boleh menggunakan mekanisme pelayar/sesi/cache yang diperlukan untuk mengendalikan pengesahan. Log keluar mempengaruhi aliran sesi yang disokong; salinan penyedia dan pelayar tertakluk kepada cara pengendalian masing-masing.",
    "Sumber web semasa tidak mengaktifkan cache luar talian Firestore yang berterusan, Firebase Analytics, piksel pemasaran atau penjejak pengiklanan pihak ketiga. Mekanisme penyampaian/pengesahan penyedia yang diperlukan berbeza daripada aktiviti marketplace yang direkodkan oleh TAKEME. Notis ini tidak memperkenalkan kuki pemasaran atau penjejakan merentas laman web.",
    "Aktiviti marketplace yang disokong digunakan untuk penemuan dan pengukuran ciri seperti diterangkan di atas. SEMAKAN UNDANG-UNDANG DIPERLUKAN — pendedahan penyedia/storan pelayar yang muktamad serta sebarang pilihan yang diperlukan ketika pelancaran awam. Sebarang pengumpulan analitik/kuki pada masa hadapan memerlukan semakan baharu sebelum pengaktifan.",
  ] },
  { id: "changes", title: "28. Perubahan kepada Notis Ini", paragraphs: [
    "Versi Privasi " + bmPrivacyDocument.version + " menggunakan sumber polisi V1 berpusat. Tarikh berkuat kuasanya ialah tarikh pelancaran awam sebenar yang diluluskan pemilik dan tarikh kemas kini terakhir menggunakan tarikh yang sama melainkan ditukar secara berasingan. Kedua-dua tarikh masih belum ditetapkan dalam draf ini; tiada tarikh atau pengaktifan direka-reka.",
    "Perubahan penting hendaklah mempunyai versi, tarikh serta notis atau persetujuan yang sesuai dan jelas seperti diwajibkan oleh undang-undang yang terpakai. Pengguna baharu mesti menerima versi Privasi dan Terma semasa secara nyata serta mengesahkan 18+ sebelum tindakan terlindung yang menulis data; pengguna sedia ada dengan penerimaan lapuk boleh melayari kandungan awam tetapi mesti menerima semula sebelum tindakan terlindung.",
    "Log masuk dan muat semula tidak pernah dikira sebagai penerimaan Privasi. Penerimaan semula mengekalkan bukti terdahulu serta status profil/alu-aluan yang disokong. Kembali ke konteks yang dimaksudkan tidak melaksanakan tindakan marketplace seperti menghantar mesej, membida, membuat tawaran, Save, Follow atau menerbitkan secara automatik.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — kelulusan undang-undang muktamad Privasi Bahasa Inggeris serta kandungan muktamad Privasi BM. Draf pemilik dalam Bahasa Melayu masih tertakluk kepada semakan undang-undang muktamad dan belum diluluskan untuk penerbitan. Pembayaran, penghantaran, pemberitahuan push, SDK natif atau amalan data baharu yang lain memerlukan semakan pendedahan lanjut.",
  ], links: [{ href: "/terms", label: "Baca draf Terma Perkhidmatan" }] },
  { id: "contact", title: "29. Hubungi Kami", paragraphs: [
    marketplaceOperator.name + ". No. Pendaftaran SSM " + marketplaceOperator.registrationNumber + ". Privasi dan sokongan: " + marketplaceOperator.privacyLegalEmail + ".",
    "Alamat perniagaan/surat-menyurat: " + bmPrivacyDocument.localizedBusinessAddressStatus + ". Tiada alamat diterbitkan dalam draf ini dan tiada alamat peribadi/rumah digunakan sebagai ganti.",
    "SEMAKAN UNDANG-UNDANG DIPERLUKAN — kelulusan muktamad Privasi Bahasa Inggeris, notis BM muktamad, alamat yang boleh diterbitkan serta keputusan penyedia, pemindahan, hak statutori dan penyimpanan yang belum diselesaikan seperti diterangkan di atas.",
  ], links: [{ href: "mailto:" + marketplaceOperator.privacyLegalEmail, label: "Hubungi " + marketplaceOperator.privacyLegalEmail }, { href: "/contact", label: "Maklumat hubungan" }, { href: "/help", label: "Pusat Bantuan" }] },
];
