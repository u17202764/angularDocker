import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Categoria {
  id: number;
  nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly URL = 'https://docker-java-lmse.onrender.com/listado';

  constructor(private http: HttpClient) {}

  getItems(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.URL);
  }
}
