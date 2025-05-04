import { HttpClient } from '@angular/common/http';
import {
  Injectable,
  signal
} from '@angular/core';
import {
  catchError,
  defer,
  from,
  Observable,
  of,
  switchMap,
  tap
} from 'rxjs';

export interface Categoria {
  id: number;
  nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryNewService {
  private readonly apiUrl = 'https://docker-java-lmse.onrender.com/listado'
  private readonly dbName = 'BigDataDB'
  private readonly storeName = 'records'
  private readonly dbVersion = 1
  
  private db: IDBDatabase | null = null
  private dbInitialized = false
  totalRecords = signal<number>(0)
  isLoading = signal<boolean>(false)

  constructor(private http: HttpClient) {
    this.initializeDB()
  }

  private initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('by_id', 'id', { unique: true })
        }
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        this.dbInitialized = true
        this.updateRecordCount()
        resolve()
      }
      request.onerror = (event) => {
        console.error('Error al abrir IndexedDB:', (event.target as IDBOpenDBRequest).error)
        reject('Failed to initialize database')
      }
    })
  }

  private updateRecordCount(): void {
    if (!this.db) return
    const transaction = this.db.transaction(this.storeName, 'readonly')
    const store = transaction.objectStore(this.storeName)
    const countRequest = store.count()
    countRequest.onsuccess = () => {
      this.totalRecords.set(countRequest.result)
    }
  }

  loadAllData(): Observable<void> {
    return defer(() => {
      if (!this.dbInitialized) {
        return from(this.initializeDB()).pipe(
          switchMap(() => this.loadDataFromCacheOrAPI())
        )
      }
      return this.loadDataFromCacheOrAPI()
    })
  }

  private loadDataFromCacheOrAPI(): Observable<void> {
    return new Observable(observer => {
      if (!this.db) {
        observer.error('Database not initialized')
        return
      }
      const transaction = this.db.transaction(this.storeName, 'readonly')
      const store = transaction.objectStore(this.storeName)
      const countRequest = store.count()
      countRequest.onsuccess = () => {
        if (countRequest.result > 0) {
          this.totalRecords.set(countRequest.result)
          observer.next()
          observer.complete()
        } else {
          this.fetchFromAPI().subscribe({
            next: () => {
              observer.next()
              observer.complete()
            },
            error: (err) => observer.error(err)
          })
        }
      }
      countRequest.onerror = () => observer.error(countRequest.error)
    })
  }

  private fetchFromAPI(): Observable<void> {
    this.isLoading.set(true)
    return this.http.get<any[]>(this.apiUrl).pipe(
      switchMap(data => from(this.saveDataToDB(data))),
      tap(() => this.isLoading.set(false)),
      catchError(error => {
        this.isLoading.set(false)
        console.error('Error loading data:', error)
        return of(undefined)
      })
    )
  }

  private async saveDataToDB(data: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject('Database not initialized')
        return
      }
      // Crear una nueva transacción para cada lote
      const processBatch = (start: number) => {
        if (start >= data.length) {
          this.totalRecords.set(data.length)
          resolve()
          return
        }
        const transaction = this.db!.transaction(this.storeName, 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const end = Math.min(start + 5000, data.length)
        const batch = data.slice(start, end)
        // Procesar el lote actual
        batch.forEach(item => {
          store.put(item).onsuccess = () => {
            // Verificar si es el último elemento del lote
            if (item === batch[batch.length - 1]) {
              // Procesar siguiente lote después de un breve delay
              setTimeout(() => processBatch(end), 0)
            }
          }
        })
        transaction.onerror = () => reject(transaction.error);
      }
      // Primero limpiar la store
      const clearTransaction = this.db.transaction(this.storeName, 'readwrite')
      const clearStore = clearTransaction.objectStore(this.storeName)
      const clearRequest = clearStore.clear()
      clearRequest.onsuccess = () => processBatch(0)
      clearRequest.onerror = () => reject(clearRequest.error)
    })
  }

  getPaginatedData(page: number, pageSize: number): Observable<any[]> {
    return defer(() => {
      if (!this.dbInitialized) {
        return from(this.initializeDB()).pipe(
          switchMap(() => this.fetchPaginatedData(page, pageSize))
        )
      }
      return this.fetchPaginatedData(page, pageSize)
    })
  }

  private fetchPaginatedData(page: number, pageSize: number): Observable<any[]> {
    return new Observable(observer => {
      if (!this.db) {
        observer.error('Database not initialized')
        return
      }
      const transaction = this.db.transaction(this.storeName, 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()
      request.onsuccess = () => {
        const allData = request.result
        const start = (page - 1) * pageSize
        const end = start + pageSize
        observer.next(allData.slice(start, end))
        observer.complete()
      }
      request.onerror = () => observer.error(request.error)
    })
  }

  forceRefresh(): Observable<void> {
    return new Observable(observer => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName)
      deleteRequest.onsuccess = () => {
        this.db = null
        this.dbInitialized = false
        this.totalRecords.set(0)
        this.initializeDB().then(() => {
          this.fetchFromAPI().subscribe({
            next: () => {
              observer.next()
              observer.complete()
            },
            error: (err) => observer.error(err)
          })
        })
      }
      deleteRequest.onerror = () => {
        observer.error('Failed to clear database')
      }
    })
  }
}