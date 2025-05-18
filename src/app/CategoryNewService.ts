import { HttpClient } from '@angular/common/http';
import {
  inject,
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
  private readonly apiUrl = 'https://docker-java-lmse.onrender.com/api/public/listadoCategoria'
  private readonly dbName = 'BigDataDB'
  private readonly storeName = 'records'
  private readonly dbVersion = 1

  private db = signal<IDBDatabase | null>(null)
  private dbInitialized =signal<boolean>(false)
  public totalRecords = signal<number>(0)
  public isLoading = signal<boolean>(false)
  private listaCategorias = signal<Categoria[]>([])
  private dbReady = signal<boolean>(false)
  private initializationPromise: Promise<void> | null = null

  private http = inject(HttpClient)


  constructor() {
    this.initializeDB().catch(err => {
      console.error('Error initializing DB:', err)
    })
  }

  private async ensureDBInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeDB()
    }
    return this.initializationPromise
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
        const db = (event.target as IDBOpenDBRequest).result
        this.db.set(db)
        this.dbInitialized.set(true)
        this.dbReady.set(true)
        this.updateRecordCount()
        resolve()
      }

      request.onerror = (event) => {
        console.error('Error opening IndexedDB:', (event.target as IDBOpenDBRequest).error)
        this.dbReady.set(false)
        reject('Failed to initialize database')
      }
    })
  }

  private getDatabase(): IDBDatabase {
    const db = this.db()
    if (!db) {
      throw new Error('Database not initialized')
    }
    return db
  }

  public loadAllData(): Observable<void> {
    return defer(() => from(this.ensureDBInitialized()).pipe(
      switchMap(() => this.loadDataFromCacheOrAPI())
    ))
  }

  private updateRecordCount(): void {
    if (!this.db) return
    const transaction = this.db()!.transaction(this.storeName, 'readonly')
    const store = transaction.objectStore(this.storeName)
    const countRequest = store.count()
    countRequest.onsuccess = () => {
      this.totalRecords.set(countRequest.result)
    }
  }

  private loadDataFromCacheOrAPI(): Observable<void> {
    return new Observable(observer => {
      try {
        const db = this.getDatabase()
        const transaction = db.transaction(this.storeName, 'readwrite')
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
      } catch (error) {
        observer.error(error)
      }
    })
  }

  private fetchFromAPI(): Observable<void> {
    this.isLoading.set(true)
    return this.http.get<any[]>(this.apiUrl).pipe(
      switchMap((data: any) => from(this.saveDataToDB(data.data))),
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
      // Limpiar la store antes de agregar nuevos datos
      const clearTransaction = this.db()!.transaction(this.storeName, 'readwrite')
      const clearStore = clearTransaction.objectStore(this.storeName)
      const clearRequest = clearStore.clear()
      clearRequest.onsuccess = () => {
        // Ahora guardamos los datos
        const processBatch = (start: number) => {
          if (start >= data.length) {
            this.totalRecords.set(data.length)
            resolve()
            return
          }
          const transaction = this.db()!.transaction(this.storeName, 'readwrite')
          const store = transaction.objectStore(this.storeName)
          const end = Math.min(start + 5000, data.length)
          const batch = data.slice(start, end)
          // Procesar el lote actual
          batch.forEach(item => {
            store.put(item).onsuccess = () => {
              // Verificar si es el último elemento del lote
              if (item === batch[batch.length - 1]) {
                setTimeout(() => processBatch(end), 0)
              }
            }
          })
          transaction.onerror = () => reject(transaction.error)
        }
        processBatch(0)
      }
      clearRequest.onerror = () => reject(clearRequest.error)
    })
  }

  public getPaginatedData(page: number, pageSize: number): Observable<any[]> {
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
      const transaction = this.db()!.transaction(this.storeName, 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const allData = request.result
        // Ordenamos los datos por ID descendente para que los más nuevos aparezcan primero
        const sortedData = [...allData].sort((a, b) => b.id - a.id)
        const start = (page - 1) * pageSize
        const end = start + pageSize
        observer.next(sortedData.slice(start, end))
        observer.complete()
      }
      request.onerror = () => observer.error(request.error)
    })
  }

  public addNewRecord(newItem: Categoria): Observable<void> {
    return new Observable(observer => {
      if (!this.db) {
        observer.error('Database not initialized')
        return
      }
      // Primero obtenemos todos los registros existentes
      const getAllTransaction = this.db()!.transaction(this.storeName, 'readonly')
      const getAllStore = getAllTransaction.objectStore(this.storeName)
      const getAllRequest = getAllStore.getAll()
      getAllRequest.onsuccess = () => {
        const allData = getAllRequest.result
        // Creamos un nuevo array con el nuevo item primero
        const updatedCategories = [newItem, ...allData]
        // Ahora actualizamos toda la base de datos
        const clearTransaction = this.db()!.transaction(this.storeName, 'readwrite')
        const clearStore = clearTransaction.objectStore(this.storeName)
        const clearRequest = clearStore.clear()
        clearRequest.onsuccess = () => {
          // Insertamos todos los registros (con el nuevo primero)
          const putTransaction = this.db()!.transaction(this.storeName, 'readwrite')
          const putStore = putTransaction.objectStore(this.storeName)
          // Función para insertar los items en orden
          const insertItems = (index: number) => {
            if (index >= updatedCategories.length) {
              this.totalRecords.set(updatedCategories.length)
              this.listaCategorias.set(updatedCategories)
              observer.next()
              observer.complete()
              return
            }
            const item = updatedCategories[index]
            const putRequest = putStore.put(item)
            putRequest.onsuccess = () => {
              insertItems(index + 1)
            }
            putRequest.onerror = () => {
              observer.error(putRequest.error)
            }
          }
          insertItems(0)
        }

        clearRequest.onerror = () => {
          observer.error(clearRequest.error)
        }
      }

      getAllRequest.onerror = () => {
        observer.error(getAllRequest.error)
      }
    })
  }
}