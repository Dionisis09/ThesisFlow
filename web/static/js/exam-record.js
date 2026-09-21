const printButton = document.querySelector('#print-record');

// Ανοίγει τον μηχανισμό εκτύπωσης του browser για εκτύπωση ή αποθήκευση σε PDF.
function printExamRecord() {
  window.print();
}

printButton?.addEventListener('click', printExamRecord);
