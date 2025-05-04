import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay, tap } from 'rxjs';

export interface Categoria {
  id: number;
  nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private cache$: Observable<Categoria[]> | null = null;
  private http = inject(HttpClient);
  private readonly CACHE_KEY = 'categorias_cache';
  private readonly CACHE_EXPIRATION = 1000 * 60 * 1; // 5 minutos
  private readonly URL = 'https://docker-java-lmse.onrender.com/listado';

  getAllData(): Observable<Categoria[]> {
    if (!this.cache$) {
      const cachedData = this.getFromLocalStorage();
      
      if (cachedData) {
        console.log('Usando datos desde localStorage');
        this.cache$ = of(cachedData).pipe(shareReplay(1));
      } else {
        console.log('Haciendo nueva solicitud HTTP');
        this.cache$ = this.http.get<Categoria[]>(this.URL).pipe(
          tap(data => this.saveToLocalStorage(data)),
          shareReplay(1)
        );
      }
    }
    return this.cache$;
  }

  private saveToLocalStorage(data: Categoria[]): void {
    const cacheData = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
  }

  private getFromLocalStorage(): Categoria[] | null {
    const cached = localStorage.getItem(this.CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > this.CACHE_EXPIRATION;
    
    return isExpired ? null : parsed.data;
  }

  clearCache(): void {
    this.cache$ = null;
    localStorage.removeItem(this.CACHE_KEY);
  }
}