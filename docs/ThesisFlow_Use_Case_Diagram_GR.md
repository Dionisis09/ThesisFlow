# ThesisFlow — Use Case Diagram

Απλοποιημένο διάγραμμα με τα βασικά use cases ανά ρόλο.

```mermaid
flowchart TB
    AUTH(["Κοινή λειτουργία: Σύνδεση / Αποσύνδεση"])

    subgraph PROFESSOR_LANE[" "]
        direction LR
        PROFESSOR(("Διδάσκων"))
        P1(["Διαχείριση θεμάτων"])
        P2(["Αρχική ανάθεση θέματος"])
        P3(["Προβολή και εξαγωγή διπλωματικών"])
        P4(["Απάντηση σε προσκλήσεις τριμελούς"])
        P5(["Στατιστικά"])
        P6(["Διαχείριση κατάστασης και βαθμολόγηση"])
        PROFESSOR --- P1
        PROFESSOR --- P2
        PROFESSOR --- P3
        PROFESSOR --- P4
        PROFESSOR --- P5
        PROFESSOR --- P6
    end

    subgraph STUDENT_LANE[" "]
        direction LR
        STUDENT(("Φοιτητής"))
        S1(["Προβολή διπλωματικής"])
        S2(["Ενημέρωση στοιχείων επικοινωνίας"])
        S3(["Συγκρότηση τριμελούς επιτροπής"])
        S4(["Υποβολή εργασίας και παρουσίασης"])
        S5(["Πρακτικό, βαθμοί και Νημερτής"])
        STUDENT --- S1
        STUDENT --- S2
        STUDENT --- S3
        STUDENT --- S4
        STUDENT --- S5
    end

    subgraph SECRETARIAT_LANE[" "]
        direction LR
        SECRETARIAT(("Γραμματεία"))
        A1(["Παρακολούθηση διπλωματικών"])
        A2(["Εισαγωγή δεδομένων"])
        A3(["Καταχώριση επίσημης ανάθεσης ή ακύρωσης"])
        A4(["Περάτωση διπλωματικής"])
        SECRETARIAT --- A1
        SECRETARIAT --- A2
        SECRETARIAT --- A3
        SECRETARIAT --- A4
    end

    subgraph PUBLIC_LANE[" "]
        direction LR
        PUBLIC(("Δημόσιος χρήστης"))
        D1(["Προβολή ανακοινώσεων παρουσιάσεων"])
        PUBLIC --- D1
    end

    %% Βασικές σχέσεις της επιχειρησιακής ροής
    P2 -. "προϋπόθεση" .-> S3
    S3 -. "πρόσκληση / απάντηση" .-> P4
    P4 -. "2 αποδοχές → ενεργοποίηση" .-> P6
    P6 -. "Υπό Εξέταση → επιτρέπει" .-> S4
    S4 -. "τροφοδοτεί την ανακοίνωση" .-> D1
    P6 -. "βαθμολόγηση → παράγει" .-> S5
    S5 -. "βαθμοί + Νημερτής → επιτρέπουν" .-> A4

    subgraph LIFECYCLE["Κύκλος ζωής διπλωματικής"]
        direction LR
        ST1["ΥΠΟ ΑΝΑΘΕΣΗ"]
        ST2["ΕΝΕΡΓΗ"]
        ST3["ΥΠΟ ΕΞΕΤΑΣΗ"]
        ST4["ΠΕΡΑΤΩΜΕΝΗ"]
        ST5["ΑΚΥΡΩΜΕΝΗ"]

        ST1 -->|"2 αποδοχές τριμελούς"| ST2
        ST2 -->|"Επιβλέπων"| ST3
        ST3 -->|"3 βαθμοί + Νημερτής + γραμματεία"| ST4
        ST2 -->|"Απόφαση ΓΣ"| ST5
        ST3 -->|"Απόφαση ΓΣ"| ST5
    end

    style PROFESSOR_LANE fill:#f8fafc,stroke:#b9c7da
    style STUDENT_LANE fill:#f8fafc,stroke:#b9c7da
    style SECRETARIAT_LANE fill:#f8fafc,stroke:#b9c7da
    style PUBLIC_LANE fill:#f8fafc,stroke:#b9c7da
```

Οι συνεχείς γραμμές συνδέουν κάθε ρόλο με τις λειτουργίες του. Οι διακεκομμένες
γραμμές δείχνουν τις βασικές εξαρτήσεις και τη σειρά ενεργοποίησης μεταξύ των
use cases.
