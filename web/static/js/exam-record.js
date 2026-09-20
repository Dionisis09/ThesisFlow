const printButton = document.querySelector('#print-record');

function printExamRecord() {
  window.print();
}

printButton?.addEventListener('click', printExamRecord);
