import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { RegistroResto, RegistroExtra } from '../types';

const REST_DAYS_COLLECTION = 'restDays';
const EXTRA_DAYS_COLLECTION = 'extraDays';

// Subscribe to real-time updates for rest days
export const subscribeRestDays = (callback: (data: RegistroResto[]) => void) => {
  const colRef = collection(db, REST_DAYS_COLLECTION);
  return onSnapshot(
    colRef,
    async (snapshot) => {
      // If Firestore is empty on first run, check if we have local data to migrate
      if (snapshot.empty) {
        const localSaved = localStorage.getItem('restDays');
        if (localSaved) {
          try {
            const parsed: RegistroResto[] = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const batch = writeBatch(db);
              parsed.forEach((item) => {
                const docRef = doc(db, REST_DAYS_COLLECTION, item.id);
                batch.set(docRef, item);
              });
              await batch.commit();
              return;
            }
          } catch (e) {
            console.error('Error migrating local rest days', e);
          }
        }
      }

      const list: RegistroResto[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as RegistroResto);
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, REST_DAYS_COLLECTION);
    }
  );
};

// Save single rest day
export const saveRestDayDoc = async (data: RegistroResto) => {
  const path = `${REST_DAYS_COLLECTION}/${data.id}`;
  try {
    const docRef = doc(db, REST_DAYS_COLLECTION, data.id);
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Delete single rest day
export const deleteRestDayDoc = async (id: string) => {
  const path = `${REST_DAYS_COLLECTION}/${id}`;
  try {
    const docRef = doc(db, REST_DAYS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Subscribe to real-time updates for extra days
export const subscribeExtraDays = (callback: (data: RegistroExtra[]) => void) => {
  const colRef = collection(db, EXTRA_DAYS_COLLECTION);
  return onSnapshot(
    colRef,
    async (snapshot) => {
      // If Firestore is empty on first run, check if we have local data to migrate
      if (snapshot.empty) {
        const localSaved = localStorage.getItem('extraDays');
        if (localSaved) {
          try {
            const parsed: RegistroExtra[] = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const batch = writeBatch(db);
              parsed.forEach((item) => {
                const docRef = doc(db, EXTRA_DAYS_COLLECTION, item.id);
                batch.set(docRef, item);
              });
              await batch.commit();
              return;
            }
          } catch (e) {
            console.error('Error migrating local extra days', e);
          }
        }
      }

      const list: RegistroExtra[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as RegistroExtra);
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, EXTRA_DAYS_COLLECTION);
    }
  );
};

// Save or update single extra day with automatic synchronization to restDays
export const saveExtraDayDoc = async (data: RegistroExtra) => {
  const path = `${EXTRA_DAYS_COLLECTION}/${data.id}`;
  try {
    const docRef = doc(db, EXTRA_DAYS_COLLECTION, data.id);
    await setDoc(docRef, data);

    // If marked as worked rest day, create or update matching record in restDays
    if (data.esDescansoTrabajado) {
      const restDocRef = doc(db, REST_DAYS_COLLECTION, data.id);
      const restRecord: RegistroResto = {
        id: data.id,
        operarioId: data.operarioId,
        fecha: data.fecha,
        tipoDia: data.tipoDia || 'Descanso entre semana',
        trabajo: true,
        horas: data.totalHoras || (data.ordinarias + data.extraDiurna + data.extraNocturna + data.extraDominical) || 8,
      };
      await setDoc(restDocRef, restRecord);
    } else {
      // If NOT a worked rest day, clean up any previous restDays doc with this ID to prevent orphan counts
      const restDocRef = doc(db, REST_DAYS_COLLECTION, data.id);
      await deleteDoc(restDocRef).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Delete single extra day with cleanup in restDays
export const deleteExtraDayDoc = async (id: string) => {
  const path = `${EXTRA_DAYS_COLLECTION}/${id}`;
  try {
    const docRef = doc(db, EXTRA_DAYS_COLLECTION, id);
    await deleteDoc(docRef);

    // Also delete from restDays to ensure no orphan count remains
    const restDocRef = doc(db, REST_DAYS_COLLECTION, id);
    await deleteDoc(restDocRef).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
